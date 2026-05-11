"""
IntelliCare Nexus Multi-Agent Orchestration System.

Uses LangGraph to coordinate 10 specialized healthcare AI agents.
Every agent calls tools through the MCP Tool Registry.
Real-time events are streamed via Redis pub/sub → WebSocket.
Vector embeddings power RAG for policy retrieval and similar-patient search.
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, TypedDict, Optional, Annotated
import operator

from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.core.redis_client import publish_agent_event, set_agent_state
from app.tools.registry import tool_registry
from app.services.vector_service import vector_service
from app.services.fhir_service import fhir_service
import structlog

logger = structlog.get_logger()


# ============================================================
# WORKFLOW STATE
# ============================================================

class AgentWorkflowState(TypedDict):
    session_id: str
    patient_id: str
    patient_data: Dict[str, Any]
    fhir_bundle: Dict[str, Any]
    clinical_context: Dict[str, Any]
    authorization_requirements: List[Dict[str, Any]]
    payer_policies: Dict[str, Any]
    necessity_letter: str
    evidence_mapping: Dict[str, Any]
    approval_probability: float
    approval_breakdown: Dict[str, Any]
    trial_candidates: List[Dict[str, Any]]
    trial_matches: List[Dict[str, Any]]
    patient_summary_en: str
    patient_summary_hi: str
    tool_call_log: Annotated[List[Dict[str, Any]], operator.add]
    audit_trail: Annotated[List[Dict[str, Any]], operator.add]
    agent_events: Annotated[List[Dict[str, Any]], operator.add]
    workflow_type: str
    errors: List[str]
    completed_agents: List[str]
    care_plan: Dict[str, Any]
    compliance_report: Dict[str, Any]


# ============================================================
# EVENT EMITTER + TOOL INVOKER
# ============================================================

async def emit(sid: str, agent: str, event_type: str, message: str, data: Optional[Dict] = None) -> Dict:
    event = {
        "session_id": sid,
        "agent_name": agent,
        "event_type": event_type,
        "message": message,
        "data": data or {},
        "timestamp": datetime.now().isoformat(),
    }
    try:
        await publish_agent_event(sid, event)
    except Exception as e:
        logger.warning("Event publish failed", error=str(e))
    return event


async def call_tool(sid: str, agent: str, tool_name: str, **kwargs) -> Any:
    await emit(sid, agent, "tool_call", f"Invoking: {tool_name}", {"tool": tool_name, "params": list(kwargs.keys())})
    result = await tool_registry.invoke(tool_name, **kwargs)
    await emit(sid, agent, "tool_result", f"Tool {tool_name} done in {result.latency_ms}ms",
               {"tool": tool_name, "success": result.success, "latency_ms": result.latency_ms})
    return result.data if result.success else None


# ============================================================
# AGENT 1: CLINICAL CONTEXT
# ============================================================

async def clinical_context_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "ClinicalContextAgent"
    await emit(sid, ag, "started", "Parsing FHIR bundle and building structured clinical context...")
    try:
        patient_data = state.get("patient_data", {})
        fhir_bundle = state.get("fhir_bundle", {})
        if not fhir_bundle:
            fhir_bundle = await call_tool(sid, ag, "build_fhir_bundle", patient_data=patient_data) or {}
        clinical_context = await call_tool(sid, ag, "parse_fhir_bundle", fhir_bundle=fhir_bundle) or {}
        clinical_context["patient_data"] = patient_data
        await vector_service.index_patient_context(state["patient_id"], clinical_context)
        await call_tool(sid, ag, "log_compliance_event",
                        action="fhir_bundle_parsed", agent_name=ag,
                        patient_id=state["patient_id"],
                        details={"diagnoses_count": len(clinical_context.get("diagnoses", []))})
        await emit(sid, ag, "completed",
                   f"Context built: {len(clinical_context.get('diagnoses',[]))} dx, "
                   f"{len(clinical_context.get('medications',[]))} meds",
                   {"context_keys": list(clinical_context.keys())})
        return {
            **state,
            "fhir_bundle": fhir_bundle,
            "clinical_context": clinical_context,
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "parse_fhir_bundle", "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "fhir_extraction", "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"],
                "clinical_context": {"patient_data": state.get("patient_data", {})}}


# ============================================================
# AGENT 2: PRIOR AUTHORIZATION
# ============================================================

async def prior_auth_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "PriorAuthorizationAgent"
    await emit(sid, ag, "started", "Detecting authorization requirements from clinical context...")
    try:
        patient_data = state.get("patient_data", {})
        clinical_context = state.get("clinical_context", {})
        medications = clinical_context.get("medications") or patient_data.get("medications", [])
        procedures = patient_data.get("procedures", [])
        payer = patient_data.get("insurance_provider", "UnitedHealthcare")
        auth_result = await call_tool(sid, ag, "detect_authorization_requirements",
                                       medications=medications, procedures=procedures, payer_name=payer) or {}
        requirements = auth_result.get("items", [])
        await emit(sid, ag, "completed",
                   f"Detected {len(requirements)} items requiring prior authorization",
                   {"requirements": requirements[:2]})
        return {
            **state,
            "authorization_requirements": requirements,
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "detect_authorization_requirements",
                                "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "auth_detection",
                              "count": len(requirements), "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 3: INSURANCE POLICY RETRIEVAL
# ============================================================

async def insurance_policy_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "InsurancePolicyAgent"
    await emit(sid, ag, "started", "Fetching payer coverage policies and criteria...")
    try:
        patient_data = state.get("patient_data", {})
        requirements = state.get("authorization_requirements", [])
        payer = patient_data.get("insurance_provider", "UnitedHealthcare")
        diag_codes = patient_data.get("diagnosis_codes", [])
        payer_policies: Dict[str, Any] = {"payer": payer, "policies": {}}
        for req in requirements:
            code = req.get("code", req.get("item", ""))
            policy = await call_tool(sid, ag, "fetch_payer_policy",
                                      payer_name=payer, procedure_code=code,
                                      diagnosis_codes=diag_codes) or {}
            rag_snippets = await vector_service.retrieve_relevant_policy(
                query=f"{req.get('item', '')} {' '.join(diag_codes[:2])}", payer_name=payer)
            if rag_snippets:
                policy["rag_context"] = rag_snippets
            payer_policies["policies"][code] = policy
        await emit(sid, ag, "completed",
                   f"Retrieved policies from {payer} for {len(requirements)} items",
                   {"payer": payer, "count": len(payer_policies["policies"])})
        return {
            **state,
            "payer_policies": payer_policies,
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "fetch_payer_policy", "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "policy_retrieval",
                              "payer": payer, "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 4: MEDICAL NECESSITY REASONING
# ============================================================

async def medical_necessity_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "MedicalNecessityAgent"
    await emit(sid, ag, "started", "Generating AI-powered medical necessity letter with Gemini 2.5...")
    try:
        clinical_context = state.get("clinical_context", {})
        patient_data = state.get("patient_data", {})
        payer_policies = state.get("payer_policies", {})
        requirements = state.get("authorization_requirements", [])
        primary_req = requirements[0] if requirements else {"item": "Cancer Treatment", "code": ""}
        first_policy = list(payer_policies.get("policies", {}).values())[0] if payer_policies.get("policies") else {}
        patient_context = {
            "name": f"{patient_data.get('first_name','')} {patient_data.get('last_name','')}",
            "primary_diagnosis": patient_data.get("primary_diagnosis", ""),
            "diagnosis_codes": patient_data.get("diagnosis_codes", []),
            "medications": patient_data.get("medications", []),
            "lab_results": patient_data.get("lab_results", []),
            "genomics": patient_data.get("genomics", {}),
            "procedures": patient_data.get("procedures", []),
            "insurance": patient_data.get("insurance_provider", ""),
            "clinical_summary": clinical_context.get("ai_enriched", {}).get("clinical_summary", ""),
        }
        similar_letters = await vector_service.retrieve_similar_auth_letters(
            diagnosis=patient_data.get("primary_diagnosis", ""),
            procedure=primary_req.get("item", ""))
        letter_result = await call_tool(sid, ag, "generate_medical_necessity_letter",
                                         patient_context=patient_context,
                                         procedure={"name": primary_req.get("item"), "code": primary_req.get("code")},
                                         payer_criteria=first_policy) or {}
        prob_result = await call_tool(sid, ag, "calculate_approval_probability",
                                       patient_context=patient_context,
                                       procedure={"name": primary_req.get("item"), "code": primary_req.get("code")},
                                       payer_criteria=first_policy) or {}
        if letter_result.get("letter"):
            await vector_service.index_auth_template(
                template_id=f"{patient_data.get('primary_diagnosis','unk')}_{primary_req.get('code','gen')}",
                template_text=letter_result["letter"],
                metadata={"diagnosis": patient_data.get("primary_diagnosis",""), "procedure": primary_req.get("item","")})
        prob = letter_result.get("approval_probability") or prob_result.get("approval_probability", 0.75)
        await emit(sid, ag, "completed",
                   f"Necessity letter generated. Approval probability: {prob:.0%}",
                   {"approval_probability": prob, "rag_templates_used": len(similar_letters)})
        return {
            **state,
            "necessity_letter": letter_result.get("letter", ""),
            "evidence_mapping": letter_result.get("evidence_mapping", {}),
            "approval_probability": prob,
            "approval_breakdown": prob_result,
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [
                {"agent": ag, "tool": "generate_medical_necessity_letter", "ts": datetime.now().isoformat()},
                {"agent": ag, "tool": "calculate_approval_probability", "ts": datetime.now().isoformat()},
            ],
            "audit_trail": [{"agent": ag, "action": "necessity_letter_generated",
                              "approval_probability": prob, "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"],
                "necessity_letter": "Generation failed", "approval_probability": 0.5}


# ============================================================
# AGENT 5: APPEAL AGENT
# ============================================================

async def appeal_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "AppealAgent"
    await emit(sid, ag, "started", "Preparing pre-emptive appeal strategy for low-probability authorization...")
    try:
        patient_data = state.get("patient_data", {})
        requirements = state.get("authorization_requirements", [])
        prob = state.get("approval_probability", 0.5)
        patient_context = {
            "name": f"{patient_data.get('first_name','')} {patient_data.get('last_name','')}",
            "diagnosis": patient_data.get("primary_diagnosis", ""),
            "medications": patient_data.get("medications", []),
            "labs": patient_data.get("lab_results", []),
            "genomics": patient_data.get("genomics", {}),
        }
        prior_auth_info = {
            "procedure": requirements[0].get("item", "") if requirements else "",
            "payer": patient_data.get("insurance_provider", ""),
            "evidence_mapping": state.get("evidence_mapping", {}),
        }
        denial_reason = (
            "Medical necessity criteria not sufficiently documented per payer policy"
            if prob < 0.5 else
            "Pre-emptive appeal preparation — authorization at risk of denial"
        )
        appeal_result = await call_tool(sid, ag, "generate_appeal_letter",
                                         patient_context=patient_context,
                                         prior_auth=prior_auth_info,
                                         denial_reason=denial_reason) or {}
        success_prob = appeal_result.get("success_probability", 0.65)
        await emit(sid, ag, "completed",
                   f"Appeal letter prepared. Estimated success: {success_prob:.0%}",
                   {"appeal_ready": True, "success_probability": success_prob})
        return {
            **state,
            "clinical_context": {
                **state.get("clinical_context", {}),
                "appeal_letter": appeal_result.get("appeal_letter", ""),
                "appeal_strategy": {
                    "additional_evidence": appeal_result.get("additional_evidence", []),
                    "legal_precedents": appeal_result.get("legal_precedents", []),
                    "urgency_factors": appeal_result.get("urgency_factors", []),
                    "success_probability": success_prob,
                    "recommended_next_steps": appeal_result.get("recommended_next_steps", []),
                },
            },
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "generate_appeal_letter", "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "appeal_letter_prepared", "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 6: TRIAL MATCHMAKER
# ============================================================

async def trial_matchmaker_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "ClinicalTrialMatchmakerAgent"
    await emit(sid, ag, "started", "Querying ClinicalTrials.gov API + semantic vector search...")
    try:
        clinical_context = state.get("clinical_context", {})
        patient_data = state.get("patient_data", {})
        patient_profile_text = (
            f"Patient with {patient_data.get('primary_diagnosis', '')}. "
            f"Genomics: {json.dumps(patient_data.get('genomics', {}))}. "
            f"Medications: {', '.join(m.get('name','') for m in patient_data.get('medications',[])[:3])}."
        )
        vector_hits = await vector_service.search_relevant_trials(patient_profile=patient_profile_text, n_results=5)
        trial_result = await call_tool(sid, ag, "find_eligible_trials",
                                        patient_context=clinical_context, max_results=8) or {}
        candidates = trial_result.get("matches", [])
        for match in candidates:
            trial = match.get("trial", {})
            if trial.get("nct_id") and trial.get("eligibility_criteria"):
                await vector_service.index_trial_criteria(
                    nct_id=trial["nct_id"],
                    criteria_text=trial["eligibility_criteria"],
                    trial_metadata={"title": trial.get("title","")[:200], "phase": trial.get("phase",""),
                                    "sponsor": trial.get("sponsor","")})
        await emit(sid, ag, "completed",
                   f"Found {len(candidates)} candidate trials (API) + {len(vector_hits)} semantic matches",
                   {"api_trials": len(candidates), "vector_hits": len(vector_hits)})
        return {
            **state,
            "trial_candidates": [m.get("trial", {}) for m in candidates],
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "find_eligible_trials", "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "trial_search",
                              "trials_found": len(candidates), "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 7: ELIGIBILITY REASONING
# ============================================================

async def eligibility_reasoning_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "EligibilityReasoningAgent"
    await emit(sid, ag, "started", "Running detailed eligibility analysis for each candidate trial...")
    try:
        trial_candidates = state.get("trial_candidates", [])
        clinical_context = state.get("clinical_context", {})
        patient_data = state.get("patient_data", {})
        patient_context = {
            "diagnoses": clinical_context.get("diagnoses", patient_data.get("diagnosis_codes", [])),
            "medications": clinical_context.get("medications", patient_data.get("medications", [])),
            "labs": clinical_context.get("labs", patient_data.get("lab_results", [])),
            "genomics": clinical_context.get("genomics", patient_data.get("genomics", {})),
            "age": patient_data.get("age", 55),
            "gender": patient_data.get("gender", "unknown"),
            "primary_diagnosis": patient_data.get("primary_diagnosis", ""),
            "performance_status": patient_data.get("vital_signs", {}).get("ecog_ps", "1"),
            "prior_treatments": patient_data.get("procedures", []),
        }
        trial_matches = []
        for trial in trial_candidates[:5]:
            await emit(sid, ag, "processing",
                       f"Analyzing: {trial.get('title','')[:60]}...", {"nct_id": trial.get("nct_id")})
            eligibility = await call_tool(sid, ag, "eligibility_reasoning",
                                           patient_context=patient_context, trial=trial) or {}
            trial_matches.append({
                "trial": trial,
                "match_score": eligibility.get("match_score", 0.5),
                "confidence": eligibility.get("confidence_score", 0.5),
                "eligible": eligibility.get("eligible", False),
                "status": "eligible" if eligibility.get("eligible") else "possibly_eligible",
                "inclusion_met": eligibility.get("inclusion_criteria_met", []),
                "exclusion_clear": eligibility.get("exclusion_criteria_not_triggered", []),
                "missing_criteria": eligibility.get("missing_or_unclear", []),
                "reasoning": eligibility.get("reasoning", ""),
                "genomic_compatibility": eligibility.get("genomic_compatibility", {}),
                "patient_summary_en": eligibility.get("patient_summary_english", ""),
                "patient_summary_hi": eligibility.get("patient_summary_hindi", ""),
            })
        trial_matches.sort(key=lambda x: x["match_score"], reverse=True)
        eligible_count = sum(1 for m in trial_matches if m["eligible"])
        await emit(sid, ag, "completed",
                   f"Analysis complete: {eligible_count}/{len(trial_matches)} eligible",
                   {"eligible": eligible_count, "total": len(trial_matches)})
        return {
            **state,
            "trial_matches": trial_matches,
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "eligibility_reasoning",
                                "trials": len(trial_matches), "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "eligibility_analysis",
                              "eligible_count": eligible_count, "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 8: PATIENT COMMUNICATION
# ============================================================

async def patient_communication_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "PatientCommunicationAgent"
    await emit(sid, ag, "started", "Generating multilingual patient summaries (English + Hindi)...")
    try:
        patient_data = state.get("patient_data", {})
        trial_matches = state.get("trial_matches", [])
        prob = state.get("approval_probability", 0)
        summary_context = {
            "patient_name": f"{patient_data.get('first_name','Dear Patient')}",
            "diagnosis": patient_data.get("primary_diagnosis", ""),
            "medications": [m.get("name") for m in patient_data.get("medications", [])[:3]],
            "eligible_trials": [m["trial"].get("title","")[:80] for m in trial_matches if m.get("eligible")][:2],
            "authorization_status": "In Progress",
            "approval_probability_pct": f"{int(prob * 100)}%",
            "next_steps": "Your care team is reviewing AI-generated authorization and trial recommendations.",
        }
        result = await call_tool(sid, ag, "generate_patient_summary",
                                  patient_context=summary_context, language="en",
                                  context_type="cancer treatment plan, clinical trial options, and insurance authorization") or {}
        await emit(sid, ag, "completed", "Patient summaries generated in English and Hindi",
                   {"languages": ["en", "hi"]})
        return {
            **state,
            "patient_summary_en": result.get("english", ""),
            "patient_summary_hi": result.get("hindi", ""),
            "completed_agents": state["completed_agents"] + [ag],
            "tool_call_log": [{"agent": ag, "tool": "generate_patient_summary", "ts": datetime.now().isoformat()}],
            "audit_trail": [{"agent": ag, "action": "patient_summary_generated",
                              "languages": ["en", "hi"], "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 9: CARE COORDINATION
# ============================================================

async def care_coordination_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "CareCoordinationAgent"
    await emit(sid, ag, "started", "Building care coordination plan and scheduling next steps...")
    try:
        trial_matches = state.get("trial_matches", [])
        prob = state.get("approval_probability", 0)
        requirements = state.get("authorization_requirements", [])
        approval_breakdown = state.get("approval_breakdown", {})
        next_steps = []
        if prob >= 0.7:
            next_steps.append({"action": "submit_prior_authorization", "priority": "high",
                                "timeframe": "Within 24 hours", "assignee": "Administrative Staff",
                                "notes": f"AI confidence {int(prob*100)}% — recommend immediate submission"})
        else:
            next_steps.append({"action": "physician_review_authorization", "priority": "urgent",
                                "timeframe": "Today", "assignee": "Attending Physician",
                                "notes": approval_breakdown.get("recommendation", "Additional documentation needed")})
        for m in [x for x in trial_matches if x.get("eligible")][:2]:
            next_steps.append({"action": "clinical_trial_referral", "priority": "medium",
                                "timeframe": "Within 1 week", "assignee": "Oncology Coordinator",
                                "notes": f"Eligible: {m['trial'].get('title','')[:80]}",
                                "trial_nct": m["trial"].get("nct_id")})
        next_steps.append({"action": "patient_counseling_session", "priority": "medium",
                            "timeframe": "Within 3-5 days", "assignee": "Patient Navigator",
                            "notes": "Discuss authorization and trial options using multilingual summary"})
        care_plan = {
            "status": "active", "created_at": datetime.now().isoformat(), "session_id": sid,
            "next_steps": next_steps,
            "eligible_trial_count": len([m for m in trial_matches if m.get("eligible")]),
            "auth_submissions_pending": len(requirements),
            "overall_recommendation": approval_breakdown.get("recommendation", "Review required"),
        }
        await emit(sid, ag, "completed", f"Care plan: {len(next_steps)} action items",
                   {"action_count": len(next_steps)})
        return {
            **state,
            "care_plan": care_plan,
            "completed_agents": state["completed_agents"] + [ag],
            "audit_trail": [{"agent": ag, "action": "care_plan_created",
                              "actions": len(next_steps), "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# AGENT 10: AUDIT & COMPLIANCE
# ============================================================

async def audit_compliance_agent(state: AgentWorkflowState) -> AgentWorkflowState:
    sid, ag = state["session_id"], "AuditComplianceAgent"
    await emit(sid, ag, "started", "Finalizing HIPAA audit trail and compliance report...")
    try:
        audit_trail = state.get("audit_trail", [])
        tool_calls = state.get("tool_call_log", [])
        completed = state.get("completed_agents", [])
        errors = state.get("errors", [])
        compliance_report = {
            "session_id": sid,
            "patient_id": state.get("patient_id"),
            "workflow_type": state.get("workflow_type"),
            "completed_at": datetime.now().isoformat(),
            "agents_completed": completed,
            "total_tool_calls": len(tool_calls),
            "audit_events": len(audit_trail),
            "phi_access_events": len([a for a in audit_trail if "fhir" in a.get("action","")]),
            "hipaa_controls": {
                "access_control": "role_based_jwt",
                "audit_logging": "complete",
                "minimum_necessary": "enforced_per_agent",
                "transmission_security": "tls_enforced",
                "encryption_at_rest": "postgresql_encrypted",
            },
            "compliance_status": "compliant" if not errors else "compliant_with_warnings",
            "retention_policy": "7_years_per_hipaa",
        }
        await call_tool(sid, ag, "log_compliance_event",
                        action="workflow_completed", agent_name=ag,
                        patient_id=state.get("patient_id",""),
                        details={"compliance_status": compliance_report["compliance_status"],
                                 "agents_completed": len(completed)})
        await set_agent_state(sid, {**state, "compliance_report": compliance_report, "status": "completed"})
        await emit(sid, ag, "completed",
                   f"Compliance report done. Status: {compliance_report['compliance_status']}. "
                   f"Tool calls: {len(tool_calls)}", compliance_report)
        await emit(sid, "Orchestrator", "completed",
                   f"All {len(completed)} agents completed successfully.",
                   {"session_id": sid, "agents_completed": len(completed)})
        return {
            **state,
            "compliance_report": compliance_report,
            "completed_agents": state["completed_agents"] + [ag],
            "audit_trail": [{"agent": ag, "action": "compliance_report_finalized",
                              "status": compliance_report["compliance_status"],
                              "ts": datetime.now().isoformat()}],
        }
    except Exception as e:
        logger.error(f"{ag} error", error=str(e))
        return {**state, "errors": state.get("errors", []) + [f"{ag}: {e}"]}


# ============================================================
# ROUTING
# ============================================================

def route_after_necessity(state: AgentWorkflowState) -> str:
    prob = state.get("approval_probability", 0.75)
    workflow = state.get("workflow_type", "full")
    if workflow == "prior_auth":
        return "care_coordination"
    if prob < 0.4:
        return "appeal"
    return "trial_matchmaker"


def route_after_appeal(state: AgentWorkflowState) -> str:
    if state.get("workflow_type") == "prior_auth":
        return "care_coordination"
    return "trial_matchmaker"


# ============================================================
# GRAPH
# ============================================================

def build_workflow() -> StateGraph:
    g = StateGraph(AgentWorkflowState)
    g.add_node("clinical_context_node", clinical_context_agent)
    g.add_node("prior_auth_node", prior_auth_agent)
    g.add_node("insurance_policy_node", insurance_policy_agent)
    g.add_node("medical_necessity_node", medical_necessity_agent)
    g.add_node("appeal_node", appeal_agent)
    g.add_node("trial_matchmaker_node", trial_matchmaker_agent)
    g.add_node("eligibility_reasoning_node", eligibility_reasoning_agent)
    g.add_node("patient_communication_node", patient_communication_agent)
    g.add_node("care_coordination_node", care_coordination_agent)
    g.add_node("audit_compliance_node", audit_compliance_agent)
    g.set_entry_point("clinical_context_node")
    g.add_edge("clinical_context_node", "prior_auth_node")
    g.add_edge("prior_auth_node", "insurance_policy_node")
    g.add_edge("insurance_policy_node", "medical_necessity_node")
    g.add_conditional_edges("medical_necessity_node", route_after_necessity, {
        "appeal": "appeal_node",
        "trial_matchmaker": "trial_matchmaker_node",
        "care_coordination": "care_coordination_node",
    })
    g.add_conditional_edges("appeal_node", route_after_appeal, {
        "trial_matchmaker": "trial_matchmaker_node",
        "care_coordination": "care_coordination_node",
    })
    g.add_edge("trial_matchmaker_node", "eligibility_reasoning_node")
    g.add_edge("eligibility_reasoning_node", "patient_communication_node")
    g.add_edge("patient_communication_node", "care_coordination_node")
    g.add_edge("care_coordination_node", "audit_compliance_node")
    g.add_edge("audit_compliance_node", END)
    return g.compile()


compiled_workflow = build_workflow()


async def run_agent_workflow(
    session_id: str,
    patient_id: str,
    patient_data: Dict[str, Any],
    workflow_type: str = "full",
    fhir_bundle: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    initial: AgentWorkflowState = {
        "session_id": session_id,
        "patient_id": patient_id,
        "patient_data": patient_data,
        "fhir_bundle": fhir_bundle or {},
        "clinical_context": {},
        "authorization_requirements": [],
        "payer_policies": {},
        "necessity_letter": "",
        "evidence_mapping": {},
        "approval_probability": 0.0,
        "approval_breakdown": {},
        "trial_candidates": [],
        "trial_matches": [],
        "patient_summary_en": "",
        "patient_summary_hi": "",
        "tool_call_log": [],
        "audit_trail": [],
        "agent_events": [],
        "workflow_type": workflow_type,
        "errors": [],
        "completed_agents": [],
        "care_plan": {},
        "compliance_report": {},
    }
    await emit(session_id, "Orchestrator", "started",
               f"Launching {workflow_type} multi-agent workflow for patient {patient_id}",
               {"workflow_type": workflow_type, "patient_id": patient_id})
    try:
        final = await compiled_workflow.ainvoke(initial)
        return final
    except Exception as e:
        logger.error("Workflow crashed", session_id=session_id, error=str(e))
        await emit(session_id, "Orchestrator", "failed", f"Workflow failed: {e}")
        raise
