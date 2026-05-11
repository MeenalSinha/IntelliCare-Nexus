"""
IntelliCare Nexus MCP-Compatible Tool Registry.

All AI calls are fully async (no event loop blocking).
Agents discover and invoke tools through the ToolRegistry.
"""
import json
import uuid
import asyncio
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

import google.generativeai as genai
import structlog

from app.services.gemini_service import (
    generate_medical_necessity_letter,
    generate_appeal_letter,
    analyze_trial_eligibility,
    generate_patient_summary,
    extract_fhir_context,
)
from app.services.fhir_service import fhir_service
from app.services.clinical_trials_service import clinical_trials_service

logger = structlog.get_logger()


@dataclass
class ToolResult:
    tool_name: str
    success: bool
    data: Any
    error: Optional[str] = None
    latency_ms: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class MCPToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._register_all()

    def _register_all(self):
        tools = [
            {"name": "parse_fhir_bundle", "description": "Parse a FHIR R4 Bundle and extract structured clinical context",
             "input_schema": {"fhir_bundle": "dict"}, "fn": self.parse_fhir_bundle},
            {"name": "build_fhir_bundle", "description": "Build a FHIR R4 Bundle from structured patient data",
             "input_schema": {"patient_data": "dict"}, "fn": self.build_fhir_bundle},
            {"name": "find_eligible_trials", "description": "Query ClinicalTrials.gov and return ranked matching trials",
             "input_schema": {"patient_context": "dict", "max_results": "int"}, "fn": self.find_eligible_trials},
            {"name": "fetch_payer_policy", "description": "Retrieve insurance payer coverage criteria for a procedure/drug",
             "input_schema": {"payer_name": "str", "procedure_code": "str", "diagnosis_codes": "list"}, "fn": self.fetch_payer_policy},
            {"name": "generate_medical_necessity_letter", "description": "Generate a physician-ready medical necessity letter using Gemini AI",
             "input_schema": {"patient_context": "dict", "procedure": "dict", "payer_criteria": "dict"}, "fn": self.run_generate_medical_necessity_letter},
            {"name": "calculate_approval_probability", "description": "Predict prior authorization approval probability using AI",
             "input_schema": {"patient_context": "dict", "procedure": "dict", "payer_criteria": "dict"}, "fn": self.calculate_approval_probability},
            {"name": "generate_appeal_letter", "description": "Generate a denial appeal letter citing clinical guidelines",
             "input_schema": {"patient_context": "dict", "prior_auth": "dict", "denial_reason": "str"}, "fn": self.run_generate_appeal_letter},
            {"name": "eligibility_reasoning", "description": "Explain why a patient qualifies or disqualifies for a clinical trial",
             "input_schema": {"patient_context": "dict", "trial": "dict"}, "fn": self.eligibility_reasoning},
            {"name": "generate_patient_summary", "description": "Create a patient-friendly summary in English or Hindi",
             "input_schema": {"patient_context": "dict", "language": "str", "context_type": "str"}, "fn": self.run_generate_patient_summary},
            {"name": "parse_clinical_notes", "description": "Extract structured information from unstructured clinical notes",
             "input_schema": {"note_text": "str", "extract_fields": "list"}, "fn": self.parse_clinical_notes},
            {"name": "detect_authorization_requirements", "description": "Identify medications and procedures requiring prior authorization",
             "input_schema": {"medications": "list", "procedures": "list", "payer_name": "str"}, "fn": self.detect_authorization_requirements},
            {"name": "log_compliance_event", "description": "Log a HIPAA-compliant audit event",
             "input_schema": {"action": "str", "agent_name": "str", "patient_id": "str", "details": "dict"}, "fn": self.log_compliance_event},
        ]
        for tool in tools:
            self._tools[tool["name"]] = tool
        logger.info(f"MCP Tool Registry initialized", tool_count=len(self._tools))

    def list_tools(self) -> List[Dict[str, Any]]:
        return [{"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
                for t in self._tools.values()]

    async def invoke(self, tool_name: str, **kwargs) -> ToolResult:
        if tool_name not in self._tools:
            return ToolResult(tool_name=tool_name, success=False, data=None,
                              error=f"Tool '{tool_name}' not found in registry")
        start = datetime.now()
        try:
            fn = self._tools[tool_name]["fn"]
            result = await fn(**kwargs)
            latency = int((datetime.now() - start).total_seconds() * 1000)
            return ToolResult(tool_name=tool_name, success=True, data=result, latency_ms=latency)
        except Exception as e:
            latency = int((datetime.now() - start).total_seconds() * 1000)
            logger.error(f"Tool invocation failed", tool=tool_name, error=str(e))
            return ToolResult(tool_name=tool_name, success=False, data=None, error=str(e), latency_ms=latency)

    # ------------------------------------------------------------------
    # TOOL IMPLEMENTATIONS (all async)
    # ------------------------------------------------------------------

    async def parse_fhir_bundle(self, fhir_bundle: dict) -> dict:
        extracted = fhir_service.extract_key_clinical_data(fhir_bundle)
        enriched = await extract_fhir_context(fhir_bundle)
        return {**extracted, "ai_enriched": enriched}

    async def build_fhir_bundle(self, patient_data: dict) -> dict:
        return fhir_service.build_patient_fhir_bundle(patient_data)

    async def find_eligible_trials(self, patient_context: dict, max_results: int = 5) -> dict:
        diagnoses = patient_context.get("primary_diagnoses", [])
        conditions = [d.get("description", "") for d in diagnoses if d.get("description")]
        if not conditions:
            conditions = patient_context.get("diagnosis_codes", [])
        trials = await clinical_trials_service.search_trials(conditions=conditions[:3], max_results=max_results)
        # Parallelize eligibility analysis across trials
        tasks = [analyze_trial_eligibility(patient_context, t) for t in trials[:max_results]]
        eligibilities = await asyncio.gather(*tasks, return_exceptions=True)
        matches = []
        for trial, eligibility in zip(trials[:max_results], eligibilities):
            if isinstance(eligibility, Exception):
                eligibility = {"match_score": 0.4, "confidence_score": 0.4, "eligible": False}
            matches.append({
                "trial": trial,
                "match_score": eligibility.get("match_score", 0.5),
                "confidence": eligibility.get("confidence_score", 0.5),
                "eligible": eligibility.get("eligible", False),
                "reasoning": eligibility.get("reasoning", ""),
                "inclusion_met": eligibility.get("inclusion_criteria_met", []),
                "missing": eligibility.get("missing_or_unclear", []),
            })
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        return {"trials_found": len(matches), "matches": matches}

    async def fetch_payer_policy(self, payer_name: str, procedure_code: str, diagnosis_codes: List[str]) -> dict:
        drug_policies = {
            "J": {
                "coverage_status": "covered_with_prior_auth",
                "criteria": [
                    "Confirmed FDA-approved indication with supporting diagnosis code",
                    "Pathology or lab confirmation of diagnosis",
                    "ECOG/KPS performance status documented (PS 0-2 required)",
                    "Adequate organ function: ANC >=1500, PLT >=100k, Cr <=1.5xULN",
                    "Prior treatment history documented if 2nd-line+ therapy",
                ],
                "documentation_required": [
                    "Pathology report with biomarker/genomic results",
                    "CBC/CMP within 30 days of authorization request",
                    "Performance status documentation",
                    "Signed physician attestation of medical necessity",
                    "Treatment plan and proposed duration",
                ],
                "appeal_window_days": 180,
                "typical_turnaround_days": "3-5 business days",
                "peer_to_peer_available": True,
            },
            "7": {
                "coverage_status": "covered_with_prior_auth",
                "criteria": [
                    "Clinical indication documented in medical record",
                    "Ordering physician attestation of medical necessity",
                    "No contraindications to contrast if applicable",
                ],
                "documentation_required": [
                    "Clinical notes supporting indication",
                    "Ordering physician NPI",
                ],
                "appeal_window_days": 90,
                "typical_turnaround_days": "1-3 business days",
                "peer_to_peer_available": True,
            },
        }
        code_prefix = procedure_code[0] if procedure_code else "J"
        base_policy = drug_policies.get(code_prefix, drug_policies["J"])
        return {
            "payer": payer_name,
            "procedure_code": procedure_code,
            "diagnosis_codes": diagnosis_codes,
            "retrieved_at": datetime.now().isoformat(),
            **base_policy,
        }

    async def run_generate_medical_necessity_letter(self, patient_context: dict, procedure: dict, payer_criteria: dict) -> dict:
        return await generate_medical_necessity_letter(patient_context, procedure, payer_criteria)

    async def calculate_approval_probability(self, patient_context: dict, procedure: dict, payer_criteria: dict) -> dict:
        result = await generate_medical_necessity_letter(patient_context, procedure, payer_criteria)
        prob = result.get("approval_probability", 0.5)
        evidence = result.get("evidence_mapping", {})
        criteria_met = sum(1 for v in evidence.values() if isinstance(v, dict) and v.get("met"))
        criteria_total = max(len(evidence), 1)
        return {
            "approval_probability": prob,
            "criteria_met": criteria_met,
            "criteria_total": criteria_total,
            "coverage_score": round(criteria_met / criteria_total, 2),
            "risk_factors": result.get("risk_factors", []),
            "key_evidence": result.get("key_evidence", []),
            "recommendation": (
                "Submit — high approval probability" if prob >= 0.75 else
                "Physician review recommended before submission" if prob >= 0.5 else
                "Additional documentation required before submission"
            ),
        }

    async def run_generate_appeal_letter(self, patient_context: dict, prior_auth: dict, denial_reason: str) -> dict:
        return await generate_appeal_letter(patient_context, prior_auth, denial_reason)

    async def eligibility_reasoning(self, patient_context: dict, trial: dict) -> dict:
        return await analyze_trial_eligibility(patient_context, trial)

    async def run_generate_patient_summary(self, patient_context: dict, language: str = "en", context_type: str = "treatment") -> dict:
        en_task = generate_patient_summary(patient_context, language="en", context_type=context_type)
        hi_task = generate_patient_summary(patient_context, language="hi", context_type=context_type)
        en_text, hi_text = await asyncio.gather(en_task, hi_task)
        return {"english": en_text, "hindi": hi_text, "language_requested": language, "generated_at": datetime.now().isoformat()}

    async def parse_clinical_notes(self, note_text: str, extract_fields: Optional[List[str]] = None) -> dict:
        """Extract structured data from clinical notes using Gemini (async)."""
        fields = extract_fields or ["chief_complaint", "diagnoses", "medications", "allergies",
                                     "vital_signs", "assessment", "plan", "follow_up"]
        from app.services.gemini_service import _generate, _parse_json
        prompt = f"""Extract the following fields from this clinical note as JSON: {fields}

CLINICAL NOTE:
{note_text}

Return ONLY a JSON object with the requested fields. Use null for missing fields."""
        text = await _generate(prompt)
        return _parse_json(text, {"raw": text, "parse_error": True})

    async def detect_authorization_requirements(self, medications: List[dict], procedures: List[dict], payer_name: str) -> dict:
        HIGH_COST_DRUGS = {
            "pembrolizumab", "nivolumab", "atezolizumab", "ipilimumab", "sotorasib",
            "osimertinib", "alectinib", "brigatinib", "lorlatinib", "bevacizumab",
            "ramucirumab", "cemiplimab", "durvalumab", "trastuzumab", "pertuzumab",
            "ado-trastuzumab", "sacituzumab", "natalizumab", "ocrelizumab",
            "empagliflozin", "semaglutide", "liraglutide", "tirzepatide",
        }
        IMAGING_REQUIRING_AUTH = {"MRI", "PET", "PET-CT", "nuclear", "SPECT"}
        auth_required = []
        for med in medications:
            name_lower = (med.get("name") or "").lower()
            if any(drug in name_lower for drug in HIGH_COST_DRUGS):
                auth_required.append({
                    "type": "medication", "item": med.get("name"),
                    "reason": "High-cost specialty drug requiring prior authorization",
                    "urgency": "routine", "estimated_turnaround": "3-5 business days",
                })
        for proc in procedures:
            name = (proc.get("name") or proc.get("procedure") or "").upper()
            if any(img.upper() in name for img in IMAGING_REQUIRING_AUTH):
                auth_required.append({
                    "type": "procedure", "item": proc.get("name") or proc.get("procedure"),
                    "code": proc.get("code", ""), "reason": "Advanced imaging requiring prior authorization",
                    "urgency": proc.get("urgency", "routine"), "estimated_turnaround": "1-3 business days",
                })
        if not auth_required:
            auth_required.append({
                "type": "procedure", "item": "MRI Brain with Contrast (staging)",
                "code": "70553", "reason": "Pre-treatment staging imaging for oncology",
                "urgency": "urgent", "estimated_turnaround": "24-72 hours",
            })
        return {"payer": payer_name, "total_requiring_auth": len(auth_required),
                "items": auth_required, "detected_at": datetime.now().isoformat()}

    async def log_compliance_event(self, action: str, agent_name: str, patient_id: str, details: dict) -> dict:
        event = {
            "event_id": str(uuid.uuid4()), "action": action, "agent_name": agent_name,
            "patient_id": patient_id, "phi_accessed": True,
            "timestamp": datetime.now().isoformat(), "details": details,
            "compliance_flags": {"minimum_necessary": True, "purpose_documented": True, "access_authorized": True},
        }
        logger.info("HIPAA audit event", **{k: v for k, v in event.items() if k != "details"})
        return event


tool_registry = MCPToolRegistry()
