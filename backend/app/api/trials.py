"""
Clinical Trial matching API endpoints for IntelliCare Nexus.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.models import Patient, TrialMatch, ClinicalTrial, TrialMatchStatus
from app.schemas.schemas import TrialMatchRequest
from app.services.clinical_trials_service import clinical_trials_service
from app.services.gemini_service import analyze_trial_eligibility
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/trials", tags=["clinical-trials"])


@router.post("/match")
async def match_trials_for_patient(
    request: TrialMatchRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Find and analyze clinical trial matches for a patient."""
    patient_result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get conditions to search
    conditions = request.conditions or patient.diagnosis_codes or []
    if patient.primary_diagnosis:
        conditions.insert(0, patient.primary_diagnosis)

    # Search trials
    trials = await clinical_trials_service.search_trials(
        conditions=conditions[:3],
        max_results=request.max_results,
    )

    # Quick eligibility check and save
    results = []
    for trial in trials[:5]:
        patient_context = {
            "diagnoses": patient.diagnosis_codes or [],
            "primary_diagnosis": patient.primary_diagnosis,
            "medications": patient.medications or [],
            "labs": patient.lab_results or [],
            "genomics": patient.genomics or {},
            "age": 50,
            "gender": patient.gender or "unknown",
        }

        eligibility = await analyze_trial_eligibility(patient_context, trial)

        # Save or update trial match
        trial_record = ClinicalTrial(
            nct_id=trial.get("nct_id", ""),
            title=trial.get("title", ""),
            official_title=trial.get("official_title", ""),
            status=trial.get("status", ""),
            phase=trial.get("phase", ""),
            sponsor=trial.get("sponsor", ""),
            condition=trial.get("conditions", []),
            eligibility_criteria=trial.get("eligibility_criteria", ""),
            locations=trial.get("locations", []),
        )

        # Check if trial already exists
        existing_trial = await db.execute(
            select(ClinicalTrial).where(ClinicalTrial.nct_id == trial.get("nct_id", ""))
        )
        existing = existing_trial.scalar_one_or_none()
        if not existing:
            db.add(trial_record)
            await db.flush()
            trial_db_id = trial_record.id
        else:
            trial_db_id = existing.id

        # Upsert: update if exists, create if not (handles UniqueConstraint on patient_id+trial_id)
        existing_match_result = await db.execute(
            select(TrialMatch).where(
                TrialMatch.patient_id == request.patient_id,
                TrialMatch.trial_id == trial_db_id,
            )
        )
        existing_match = existing_match_result.scalar_one_or_none()
        if existing_match:
            existing_match.match_score = eligibility.get("match_score", 0.5)
            existing_match.confidence = eligibility.get("confidence_score", 0.5)
            existing_match.status = TrialMatchStatus.ELIGIBLE if eligibility.get("eligible") else TrialMatchStatus.POSSIBLY_ELIGIBLE
            existing_match.inclusion_met = eligibility.get("inclusion_criteria_met", [])
            existing_match.exclusion_met = eligibility.get("exclusion_criteria_not_triggered", [])
            existing_match.missing_criteria = eligibility.get("missing_or_unclear", [])
            existing_match.reasoning = eligibility.get("reasoning", "")
            existing_match.patient_summary = eligibility.get("patient_summary_english", "")
            existing_match.patient_summary_hindi = eligibility.get("patient_summary_hindi", "")
        else:
            match = TrialMatch(
                patient_id=request.patient_id,
                trial_id=trial_db_id,
                match_score=eligibility.get("match_score", 0.5),
                confidence=eligibility.get("confidence_score", 0.5),
                status=TrialMatchStatus.ELIGIBLE if eligibility.get("eligible") else TrialMatchStatus.POSSIBLY_ELIGIBLE,
                inclusion_met=eligibility.get("inclusion_criteria_met", []),
                exclusion_met=eligibility.get("exclusion_criteria_not_triggered", []),
                missing_criteria=eligibility.get("missing_or_unclear", []),
                reasoning=eligibility.get("reasoning", ""),
                patient_summary=eligibility.get("patient_summary_english", ""),
                patient_summary_hindi=eligibility.get("patient_summary_hindi", ""),
            )
            db.add(match)

        results.append({
            "trial": trial,
            "match_score": eligibility.get("match_score", 0.5),
            "confidence": eligibility.get("confidence_score", 0.5),
            "eligible": eligibility.get("eligible", False),
            "status": "eligible" if eligibility.get("eligible") else "possibly_eligible",
            "inclusion_met": eligibility.get("inclusion_criteria_met", []),
            "exclusion_met": eligibility.get("exclusion_criteria_not_triggered", []),
            "missing_criteria": eligibility.get("missing_or_unclear", []),
            "reasoning": eligibility.get("reasoning", ""),
            "patient_summary_en": eligibility.get("patient_summary_english", ""),
            "patient_summary_hi": eligibility.get("patient_summary_hindi", ""),
            "genomic_compatibility": eligibility.get("genomic_compatibility", {}),
        })

    await db.commit()
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return {"matches": results, "total": len(results)}


@router.get("/patient/{patient_id}")
async def get_patient_trial_matches(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get all trial matches for a patient."""
    result = await db.execute(
        select(TrialMatch, ClinicalTrial)
        .join(ClinicalTrial, TrialMatch.trial_id == ClinicalTrial.id)
        .where(TrialMatch.patient_id == patient_id)
        .order_by(TrialMatch.match_score.desc())
    )
    rows = result.all()

    matches = []
    for match, trial in rows:
        matches.append({
            "id": str(match.id),
            "match_score": match.match_score,
            "confidence": match.confidence,
            "status": match.status.value,
            "inclusion_met": match.inclusion_met or [],
            "exclusion_met": match.exclusion_met or [],
            "missing_criteria": match.missing_criteria or [],
            "reasoning": match.reasoning,
            "patient_summary_en": match.patient_summary,
            "patient_summary_hi": match.patient_summary_hindi,
            "created_at": match.created_at.isoformat(),
            "trial": {
                "id": str(trial.id),
                "nct_id": trial.nct_id,
                "title": trial.title,
                "status": trial.status,
                "phase": trial.phase,
                "sponsor": trial.sponsor,
                "conditions": trial.condition,
                "locations": trial.locations or [],
            }
        })

    return {"matches": matches, "total": len(matches)}
