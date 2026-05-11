"""
Pydantic schemas for request/response validation in IntelliCare Nexus API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, UUID4, Field
from app.models.models import AuthorizationStatus, TrialMatchStatus, AgentStatus


# ============================================================
# AUTH SCHEMAS
# ============================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# ============================================================
# PATIENT SCHEMAS
# ============================================================

class PatientCreate(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    language_preference: str = "en"
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_group_number: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    diagnosis_codes: List[str] = []
    medications: List[Dict[str, Any]] = []
    allergies: List[str] = []
    lab_results: List[Dict[str, Any]] = []
    genomics: Dict[str, Any] = {}
    vital_signs: Dict[str, Any] = {}
    procedures: List[Dict[str, Any]] = []


class PatientResponse(BaseModel):
    id: UUID4
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    primary_diagnosis: Optional[str]
    diagnosis_codes: List[str]
    medications: List[Dict[str, Any]]
    allergies: List[str]
    lab_results: List[Dict[str, Any]]
    genomics: Dict[str, Any]
    vital_signs: Dict[str, Any]
    insurance_provider: Optional[str]
    risk_score: float
    risk_level: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientListItem(BaseModel):
    id: UUID4
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: datetime
    gender: Optional[str]
    primary_diagnosis: Optional[str]
    insurance_provider: Optional[str]
    risk_score: float
    risk_level: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# PRIOR AUTHORIZATION SCHEMAS
# ============================================================

class PriorAuthCreate(BaseModel):
    patient_id: UUID4
    procedure_code: str
    procedure_name: str
    diagnosis_codes: List[str]
    urgency: str = "routine"
    payer_name: str
    payer_id: Optional[str] = None


class PriorAuthResponse(BaseModel):
    id: UUID4
    patient_id: UUID4
    reference_number: str
    procedure_code: str
    procedure_name: str
    diagnosis_codes: List[str]
    urgency: str
    payer_name: str
    status: AuthorizationStatus
    approval_probability: float
    necessity_letter: Optional[str]
    evidence_mapping: Dict[str, Any]
    ai_reasoning: Optional[str]
    denial_reason: Optional[str]
    appeal_letter: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# CLINICAL TRIAL SCHEMAS
# ============================================================

class TrialMatchRequest(BaseModel):
    patient_id: UUID4
    max_results: int = 10
    conditions: Optional[List[str]] = None


class TrialMatchResponse(BaseModel):
    id: UUID4
    patient_id: UUID4
    trial: Dict[str, Any]
    match_score: float
    confidence: float
    status: TrialMatchStatus
    inclusion_met: List[str]
    exclusion_met: List[str]
    missing_criteria: List[str]
    reasoning: Optional[str]
    patient_summary: Optional[str]
    patient_summary_hindi: Optional[str]

    class Config:
        from_attributes = True


# ============================================================
# AGENT SCHEMAS
# ============================================================

class AgentRunRequest(BaseModel):
    patient_id: UUID4
    workflow_type: str = Field(
        default="full",
        description="Type of workflow: full, prior_auth, trial_match, appeal"
    )
    context: Optional[Dict[str, Any]] = {}


class AgentEventResponse(BaseModel):
    session_id: str
    event_type: str
    agent_name: str
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime


class AgentSessionResponse(BaseModel):
    id: UUID4
    patient_id: Optional[UUID4]
    session_type: str
    status: AgentStatus
    workflow_state: Dict[str, Any]
    agent_events: List[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ANALYTICS SCHEMAS
# ============================================================

class DashboardStats(BaseModel):
    total_patients: int
    pending_auths: int
    approved_auths: int
    denied_auths: int
    active_trials: int
    avg_approval_probability: float
    time_saved_hours: float
    approval_rate: float
    denial_rate: float
    avg_processing_days: float


class AuditLogResponse(BaseModel):
    id: UUID4
    patient_id: Optional[UUID4]
    action: str
    resource_type: Optional[str]
    agent_name: Optional[str]
    details: Dict[str, Any]
    outcome: Optional[str]
    phi_accessed: bool
    created_at: datetime

    class Config:
        from_attributes = True
