"""
Prior Authorization API endpoints for IntelliCare Nexus.
Handles authorization request creation, status updates, and appeal generation.
"""
import uuid
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.models import PriorAuthorization, Patient, AuthorizationStatus, AgentSession
from app.schemas.schemas import PriorAuthCreate, PriorAuthResponse
from app.services.gemini_service import generate_medical_necessity_letter, generate_appeal_letter
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/prior-auth", tags=["prior-authorization"])


def _generate_reference_number() -> str:
    """Generate a unique prior auth reference number."""
    import random
    import string
    prefix = "ICN"
    year = datetime.now().year
    suffix = "".join(random.choices(string.digits, k=8))
    return f"{prefix}-{year}-{suffix}"


@router.get("/", response_model=List[PriorAuthResponse])
async def list_prior_auths(
    patient_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """List prior authorization requests with optional filters."""
    query = select(PriorAuthorization)
    if patient_id:
        query = query.where(PriorAuthorization.patient_id == patient_id)
    if status:
        query = query.where(PriorAuthorization.status == status)
    query = query.offset(skip).limit(limit).order_by(PriorAuthorization.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=PriorAuthResponse, status_code=201)
async def create_prior_auth(
    auth_in: PriorAuthCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Create a new prior authorization request with AI-generated necessity letter."""
    # Verify patient exists
    patient_result = await db.execute(select(Patient).where(Patient.id == auth_in.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    prior_auth = PriorAuthorization(
        patient_id=auth_in.patient_id,
        reference_number=_generate_reference_number(),
        procedure_code=auth_in.procedure_code,
        procedure_name=auth_in.procedure_name,
        diagnosis_codes=auth_in.diagnosis_codes,
        urgency=auth_in.urgency,
        payer_name=auth_in.payer_name,
        payer_id=auth_in.payer_id,
        status=AuthorizationStatus.PENDING,
    )
    db.add(prior_auth)
    await db.flush()

    # Generate necessity letter in background (pass primitives only, not ORM objects)
    background_tasks.add_task(
        _generate_necessity_letter_background,
        str(prior_auth.id),
        str(patient.id),      # pass id string, not ORM object
        patient.primary_diagnosis or "",
        patient.diagnosis_codes or [],
        patient.medications or [],
        patient.lab_results or [],
        patient.genomics or {},
        patient.insurance_provider or "",
        auth_in.model_dump(),
    )

    await db.commit()
    await db.refresh(prior_auth)
    return prior_auth


@router.get("/{auth_id}", response_model=PriorAuthResponse)
async def get_prior_auth(
    auth_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get a prior authorization request by ID."""
    result = await db.execute(select(PriorAuthorization).where(PriorAuthorization.id == auth_id))
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(status_code=404, detail="Prior authorization not found")
    return auth


@router.post("/{auth_id}/submit", response_model=PriorAuthResponse)
async def submit_prior_auth(
    auth_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Submit a prior authorization request to the payer."""
    result = await db.execute(select(PriorAuthorization).where(PriorAuthorization.id == auth_id))
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(status_code=404, detail="Prior authorization not found")

    if auth.status != AuthorizationStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot submit authorization in status: {auth.status}")

    auth.status = AuthorizationStatus.SUBMITTED
    auth.submitted_at = datetime.now()
    await db.commit()
    await db.refresh(auth)
    return auth


@router.post("/{auth_id}/appeal", response_model=PriorAuthResponse)
async def generate_appeal(
    auth_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Generate an AI-powered appeal letter for a denied authorization."""
    result = await db.execute(select(PriorAuthorization).where(PriorAuthorization.id == auth_id))
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(status_code=404, detail="Prior authorization not found")

    if auth.status != AuthorizationStatus.DENIED:
        raise HTTPException(status_code=400, detail="Can only appeal denied authorizations")

    patient_result = await db.execute(select(Patient).where(Patient.id == auth.patient_id))
    patient = patient_result.scalar_one_or_none()

    patient_context = {
        "name": f"{patient.first_name} {patient.last_name}",
        "diagnosis": patient.primary_diagnosis,
        "medications": patient.medications,
        "labs": patient.lab_results,
        "genomics": patient.genomics,
    }

    prior_auth_context = {
        "reference_number": auth.reference_number,
        "procedure": auth.procedure_name,
        "procedure_code": auth.procedure_code,
        "payer": auth.payer_name,
        "original_letter": auth.necessity_letter,
    }

    appeal_result = await generate_appeal_letter(
        patient_context=patient_context,
        prior_auth=prior_auth_context,
        denial_reason=auth.denial_reason or "Medical necessity not established",
    )

    auth.appeal_letter = appeal_result.get("appeal_letter", "")
    auth.status = AuthorizationStatus.APPEALING
    auth.appeal_submitted_at = datetime.now()
    await db.commit()
    await db.refresh(auth)
    return auth


@router.patch("/{auth_id}/status", response_model=PriorAuthResponse)
async def update_auth_status(
    auth_id: UUID,
    new_status: str,
    denial_reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Update the status of a prior authorization (simulate payer decision)."""
    result = await db.execute(select(PriorAuthorization).where(PriorAuthorization.id == auth_id))
    auth = result.scalar_one_or_none()
    if not auth:
        raise HTTPException(status_code=404, detail="Prior authorization not found")

    try:
        auth.status = AuthorizationStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    if new_status in ("approved", "appeal_approved"):
        auth.decision_at = datetime.now()
    elif new_status == "denied":
        auth.decision_at = datetime.now()
        auth.denial_reason = denial_reason

    await db.commit()
    await db.refresh(auth)
    return auth


async def _generate_necessity_letter_background(
    auth_id: str,
    patient_id: str,
    primary_diagnosis: str,
    diagnosis_codes: list,
    medications: list,
    lab_results: list,
    genomics: dict,
    insurance_provider: str,
    auth_data: dict,
):
    """Background task to generate necessity letter. Receives only primitives — no ORM objects."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(PriorAuthorization).where(PriorAuthorization.id == uuid.UUID(auth_id))
            )
            auth = result.scalar_one_or_none()
            if not auth:
                return

            patient_context = {
                "name": "Patient",
                "age": "",
                "diagnoses": diagnosis_codes,
                "primary_diagnosis": primary_diagnosis,
                "medications": medications,
                "lab_results": lab_results,
                "genomics": genomics,
                "insurance": insurance_provider,
            }

            procedure = {
                "name": auth_data.get("procedure_name"),
                "code": auth_data.get("procedure_code"),
                "urgency": auth_data.get("urgency"),
            }

            payer_criteria = {
                "criteria": [
                    "Clinical diagnosis documentation",
                    "Treatment necessity evidence",
                    "Prior treatment history",
                ],
                "documentation_required": ["Lab results", "Pathology report", "Treatment plan"],
            }

            result_data = await generate_medical_necessity_letter(
                patient_context=patient_context,
                procedure=procedure,
                payer_criteria=payer_criteria,
            )

            auth.necessity_letter = result_data.get("letter", "")
            auth.evidence_mapping = result_data.get("evidence_mapping", {})
            auth.approval_probability = result_data.get("approval_probability", 0.5)
            auth.ai_reasoning = result_data.get("reasoning", "")

            await db.commit()
            logger.info("Necessity letter generated", auth_id=auth_id)
        except Exception as e:
            logger.error("Background letter generation failed", auth_id=auth_id, error=str(e))
