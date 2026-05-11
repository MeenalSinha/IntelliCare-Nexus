"""
Patient management API endpoints for IntelliCare Nexus.
Handles FHIR-compatible patient CRUD operations.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.models import Patient, PriorAuthorization, TrialMatch
from app.schemas.schemas import PatientCreate, PatientResponse, PatientListItem
from app.services.fhir_service import fhir_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/", response_model=List[PatientListItem])
async def list_patients(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """List all patients with optional filtering."""
    query = select(Patient)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Patient.first_name.ilike(search_term)) |
            (Patient.last_name.ilike(search_term)) |
            (Patient.mrn.ilike(search_term))
        )

    if risk_level:
        query = query.where(Patient.risk_level == risk_level)

    query = query.offset(skip).limit(limit).order_by(Patient.created_at.desc())
    result = await db.execute(query)
    patients = result.scalars().all()
    return patients


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Create a new patient record with FHIR bundle generation."""
    # Check for duplicate MRN
    existing = await db.execute(select(Patient).where(Patient.mrn == patient_in.mrn))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Patient with MRN {patient_in.mrn} already exists")

    patient_data = patient_in.model_dump()

    # Calculate basic risk score
    risk_score = _calculate_risk_score(patient_data)
    risk_level = "critical" if risk_score >= 0.8 else "high" if risk_score >= 0.6 else "medium" if risk_score >= 0.4 else "low"

    patient = Patient(
        **patient_data,
        risk_score=risk_score,
        risk_level=risk_level,
    )
    db.add(patient)
    await db.flush()

    # Generate FHIR bundle
    patient_dict = {
        "id": str(patient.id),
        **patient_data,
        "date_of_birth": patient_data["date_of_birth"].isoformat() if hasattr(patient_data["date_of_birth"], "isoformat") else str(patient_data["date_of_birth"]),
    }
    fhir_bundle = fhir_service.build_patient_fhir_bundle(patient_dict)
    patient.fhir_bundle = fhir_bundle

    await db.commit()
    await db.refresh(patient)

    logger.info("Patient created", patient_id=str(patient.id), mrn=patient.mrn)
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get a single patient by ID."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/fhir")
async def get_patient_fhir(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get the FHIR R4 bundle for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.fhir_bundle:
        patient_dict = {
            "id": str(patient.id),
            "mrn": patient.mrn,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth.isoformat(),
            "gender": patient.gender,
            "diagnosis_codes": patient.diagnosis_codes or [],
            "primary_diagnosis": patient.primary_diagnosis,
            "medications": patient.medications or [],
            "lab_results": patient.lab_results or [],
            "insurance_provider": patient.insurance_provider,
            "insurance_policy_number": patient.insurance_policy_number,
            "language_preference": patient.language_preference,
        }
        fhir_bundle = fhir_service.build_patient_fhir_bundle(patient_dict)
        patient.fhir_bundle = fhir_bundle
        await db.commit()

    return patient.fhir_bundle


@router.get("/{patient_id}/summary")
async def get_patient_summary(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get aggregated patient summary with auth and trial status."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Count prior auths
    auth_result = await db.execute(
        select(func.count()).where(PriorAuthorization.patient_id == patient_id)
    )
    auth_count = auth_result.scalar()

    # Count trial matches
    trial_result = await db.execute(
        select(func.count()).where(TrialMatch.patient_id == patient_id)
    )
    trial_count = trial_result.scalar()

    return {
        "patient": {
            "id": str(patient.id),
            "name": f"{patient.first_name} {patient.last_name}",
            "mrn": patient.mrn,
            "age": _calculate_age(patient.date_of_birth),
            "gender": patient.gender,
            "primary_diagnosis": patient.primary_diagnosis,
            "risk_level": patient.risk_level,
            "risk_score": patient.risk_score,
            "insurance_provider": patient.insurance_provider,
        },
        "prior_auth_count": auth_count,
        "trial_match_count": trial_count,
    }


def _calculate_risk_score(patient_data: dict) -> float:
    """Calculate a basic risk score based on diagnosis codes and labs."""
    score = 0.3  # Base score

    # High-risk diagnoses
    high_risk_codes = ["C34", "C50", "C61", "C25", "C16", "C18"]
    for code in patient_data.get("diagnosis_codes", []):
        if any(code.startswith(prefix) for prefix in high_risk_codes):
            score += 0.3
            break

    # Multiple medications suggest complex case
    med_count = len(patient_data.get("medications", []))
    if med_count > 5:
        score += 0.2
    elif med_count > 2:
        score += 0.1

    # Genomic findings increase score
    if patient_data.get("genomics"):
        score += 0.1

    return min(score, 1.0)


def _calculate_age(dob) -> int:
    """Calculate age from date of birth."""
    from datetime import date
    if not dob:
        return 0
    today = date.today()
    dob_date = dob.date() if hasattr(dob, "date") else dob
    return today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
