"""
Google Gemini 2.5 client for IntelliCare Nexus AI reasoning.

All calls use generate_content_async() to avoid blocking the FastAPI event loop.
Structured JSON generation with fallback parsing.
"""
import json
import re
import asyncio
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from app.core.config import settings
import structlog

logger = structlog.get_logger()

_model_cache: Optional[genai.GenerativeModel] = None


def _get_model() -> genai.GenerativeModel:
    """Lazily create and cache the Gemini model (configure once)."""
    global _model_cache
    if _model_cache is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model_cache = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                top_p=0.95,
                max_output_tokens=8192,
            ),
        )
    return _model_cache


async def _generate(prompt: str) -> str:
    """
    Async wrapper for Gemini generate_content.
    Uses generate_content_async to avoid blocking the event loop.
    Falls back to run_in_executor if async method unavailable.
    """
    model = _get_model()
    try:
        try:
            # Use native async method if available
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except AttributeError:
            # Fallback: run sync call in thread pool executor
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, model.generate_content, prompt)
            return response.text.strip()
    except Exception as e:
        logger.error("Gemini API error", error=str(e))
        return "{}"


def _parse_json(text: str, fallback: Dict) -> Dict:
    """Strip markdown fences and parse JSON, returning fallback on error."""
    cleaned = re.sub(r"^```(?:json)?\n?", "", text.strip())
    cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("JSON parse failed", error=str(e), preview=cleaned[:200])
        return fallback


async def generate_medical_necessity_letter(
    patient_context: Dict[str, Any],
    procedure: Dict[str, Any],
    payer_criteria: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate AI-powered medical necessity letter. Fully async, non-blocking."""
    prompt = f"""You are a senior clinical documentation specialist generating a medical necessity letter
for prior authorization. Generate a comprehensive, evidence-based letter.

PATIENT CONTEXT:
{json.dumps(patient_context, indent=2, default=str)}

REQUESTED PROCEDURE:
{json.dumps(procedure, indent=2, default=str)}

PAYER CRITERIA REQUIREMENTS:
{json.dumps(payer_criteria, indent=2, default=str)}

Generate a response in this EXACT JSON format:
{{
    "letter": "Full medical necessity letter text (3-4 paragraphs, physician-ready)...",
    "evidence_mapping": {{
        "diagnosis_confirmed": {{
            "requirement": "Active cancer diagnosis with histologic confirmation",
            "evidence": "Adenocarcinoma confirmed by CT-guided biopsy 2023-12-20",
            "met": true
        }},
        "performance_status": {{
            "requirement": "ECOG PS 0-2",
            "evidence": "ECOG PS 1 documented in visit notes",
            "met": true
        }}
    }},
    "approval_probability": 0.85,
    "reasoning": "Step-by-step clinical reasoning...",
    "key_evidence": ["PD-L1 TPS 85% — excellent immunotherapy candidate", "KRAS G12C mutation identified"],
    "risk_factors": ["Mild anemia may require dose modification"]
}}

The letter must address specific payer criteria, cite lab values and genomics, use proper medical terminology.
Respond ONLY with valid JSON."""

    text = await _generate(prompt)
    return _parse_json(text, {
        "letter": text,
        "evidence_mapping": {},
        "approval_probability": 0.65,
        "reasoning": "AI generation completed with partial output.",
        "key_evidence": [],
        "risk_factors": [],
    })


async def generate_appeal_letter(
    patient_context: Dict[str, Any],
    prior_auth: Dict[str, Any],
    denial_reason: str,
) -> Dict[str, Any]:
    """Generate a denial appeal letter. Fully async."""
    prompt = f"""You are an expert healthcare appeals specialist. Generate a compelling appeal letter
for a denied prior authorization citing clinical guidelines and peer-reviewed evidence.

PATIENT CONTEXT:
{json.dumps(patient_context, indent=2, default=str)}

PRIOR AUTHORIZATION DETAILS:
{json.dumps(prior_auth, indent=2, default=str)}

DENIAL REASON:
{denial_reason}

Respond in this EXACT JSON format:
{{
    "appeal_letter": "Full appeal letter (cite NCCN/AHA/ASCO guidelines, 3-5 paragraphs)...",
    "additional_evidence": ["New evidence point 1", "Peer-reviewed study supporting necessity"],
    "legal_precedents": ["NCCN Guidelines Category 1 recommendation", "Medicare LCD reference"],
    "urgency_factors": ["Clinical urgency if applicable"],
    "success_probability": 0.72,
    "recommended_next_steps": ["Request peer-to-peer review within 5 business days", "Escalate to oncology medical director"]
}}

Respond ONLY with valid JSON."""

    text = await _generate(prompt)
    return _parse_json(text, {
        "appeal_letter": text,
        "additional_evidence": [],
        "legal_precedents": [],
        "urgency_factors": [],
        "success_probability": 0.55,
        "recommended_next_steps": [],
    })


async def analyze_trial_eligibility(
    patient_context: Dict[str, Any],
    trial: Dict[str, Any],
) -> Dict[str, Any]:
    """Analyze clinical trial eligibility. Fully async."""
    prompt = f"""You are a clinical trial eligibility specialist. Analyze whether this patient
qualifies for the given clinical trial. Be precise about inclusion/exclusion criteria.

PATIENT PROFILE:
{json.dumps(patient_context, indent=2, default=str)}

CLINICAL TRIAL:
{json.dumps(trial, indent=2, default=str)}

Respond in this EXACT JSON format:
{{
    "eligible": true,
    "confidence_score": 0.87,
    "match_score": 0.82,
    "status": "eligible",
    "inclusion_criteria_met": [
        "Histologically confirmed Stage IIIB/IV NSCLC — confirmed",
        "Age >= 18 years — patient is 58",
        "ECOG PS 0-2 — documented ECOG PS 1"
    ],
    "exclusion_criteria_not_triggered": [
        "No prior checkpoint inhibitor therapy",
        "No active autoimmune disease documented"
    ],
    "missing_or_unclear": [
        "Brain MRI required to confirm absence of active CNS metastases"
    ],
    "reasoning": "Detailed explanation of eligibility determination...",
    "genomic_compatibility": {{
        "relevant_mutations": ["KRAS G12C"],
        "compatibility": "high",
        "notes": "KRAS G12C mutation directly targeted by trial intervention"
    }},
    "patient_summary_english": "Simple English explanation for the patient...",
    "patient_summary_hindi": "Hindi explanation in Devanagari script..."
}}

Respond ONLY with valid JSON."""

    text = await _generate(prompt)
    return _parse_json(text, {
        "eligible": False,
        "confidence_score": 0.5,
        "match_score": 0.5,
        "status": "possibly_eligible",
        "inclusion_criteria_met": [],
        "exclusion_criteria_not_triggered": [],
        "missing_or_unclear": ["Could not determine eligibility — please review manually"],
        "reasoning": text[:500] if text else "Analysis unavailable",
        "genomic_compatibility": {},
        "patient_summary_english": "Please ask your doctor about this clinical trial.",
        "patient_summary_hindi": "कृपया इस क्लिनिकल ट्रायल के बारे में अपने डॉक्टर से पूछें।",
    })


async def generate_patient_summary(
    patient_context: Dict[str, Any],
    language: str = "en",
    context_type: str = "general",
) -> str:
    """Generate patient-friendly summary. Fully async."""
    lang_instruction = (
        "Respond ONLY in simple Hindi (Devanagari script) that a non-medical person can understand."
        if language == "hi"
        else "Respond ONLY in simple English that a non-medical person can understand."
    )
    prompt = f"""You are a compassionate patient communication specialist. {lang_instruction}

Create a warm, reassuring, easy-to-understand summary for this patient about their {context_type}.

PATIENT DATA:
{json.dumps(patient_context, indent=2, default=str)}

Guidelines:
- Use simple, everyday language — no medical jargon
- Be empathetic and supportive
- Explain what will happen next clearly
- Keep to 3-4 short paragraphs
- Focus on what matters most to the patient

Respond ONLY with the patient summary text — no JSON, no markdown formatting."""

    return await _generate(prompt)


async def extract_fhir_context(fhir_bundle: Dict[str, Any]) -> Dict[str, Any]:
    """Extract structured clinical context from FHIR bundle. Fully async."""
    prompt = f"""You are a clinical informatics expert. Extract and structure the key clinical
information from this FHIR bundle.

FHIR BUNDLE:
{json.dumps(fhir_bundle, indent=2, default=str)}

Respond in this EXACT JSON format:
{{
    "patient_demographics": {{
        "name": "Patient Name",
        "age": 58,
        "gender": "male",
        "dob": "1966-03-15"
    }},
    "primary_diagnoses": [
        {{"code": "C34.10", "description": "Non-small cell lung cancer, unspecified", "onset": "2023-01-15"}}
    ],
    "active_medications": [
        {{"name": "Pembrolizumab", "dose": "200mg", "frequency": "Q3W", "route": "IV"}}
    ],
    "relevant_labs": [
        {{"test": "PD-L1 TPS", "value": "85%", "date": "2023-02-01", "significance": "high"}}
    ],
    "genomic_findings": [
        {{"gene": "KRAS", "variant": "G12C", "significance": "therapeutic_target"}}
    ],
    "clinical_summary": "Brief narrative summary of patient clinical status",
    "authorization_triggers": ["Pembrolizumab requires prior authorization — J9271"],
    "trial_relevant_factors": ["KRAS G12C mutation", "PD-L1 TPS 85%", "Stage IIIB NSCLC"]
}}

Respond ONLY with valid JSON."""

    text = await _generate(prompt)
    return _parse_json(text, {
        "raw_extraction": text[:500],
        "error": "Structured extraction unavailable",
        "primary_diagnoses": [],
        "active_medications": [],
        "relevant_labs": [],
        "genomic_findings": [],
        "clinical_summary": "Unable to extract structured context",
        "authorization_triggers": [],
        "trial_relevant_factors": [],
    })


async def check_gemini_health() -> Dict[str, Any]:
    """Health check for Gemini API — call at startup to validate key."""
    try:
        model = _get_model()
        response = await model.generate_content_async("Reply with exactly: OK")
        return {"status": "healthy", "response": response.text.strip()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
