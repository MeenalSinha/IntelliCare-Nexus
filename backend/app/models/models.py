"""
SQLAlchemy ORM models for IntelliCare Nexus.
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, Float, Integer,
    ForeignKey, JSON, Enum as SAEnum, func, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum


class AuthorizationStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    DENIED = "denied"
    APPEALING = "appealing"
    APPEAL_APPROVED = "appeal_approved"
    CANCELLED = "cancelled"


class TrialMatchStatus(str, enum.Enum):
    ELIGIBLE = "eligible"
    POSSIBLY_ELIGIBLE = "possibly_eligible"
    INELIGIBLE = "ineligible"
    ENROLLED = "enrolled"


class AgentStatus(str, enum.Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="physician")
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    patients = relationship("Patient", back_populates="assigned_physician")


class Patient(Base):
    __tablename__ = "patients"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrn = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(DateTime, nullable=False)
    gender = Column(String(20))
    phone = Column(String(30))
    email = Column(String(255))
    address = Column(Text)
    language_preference = Column(String(10), default="en")
    insurance_provider = Column(String(200))
    insurance_policy_number = Column(String(100))
    insurance_group_number = Column(String(100))
    primary_diagnosis = Column(String(500))
    diagnosis_codes = Column(JSON, default=list)
    medications = Column(JSON, default=list)
    allergies = Column(JSON, default=list)
    lab_results = Column(JSON, default=list)
    genomics = Column(JSON, default=dict)
    vital_signs = Column(JSON, default=dict)
    procedures = Column(JSON, default=list)
    fhir_bundle = Column(JSON, nullable=True)
    fhir_patient_id = Column(String(100), nullable=True)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="low")
    assigned_physician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    assigned_physician = relationship("User", back_populates="patients")
    prior_auths = relationship("PriorAuthorization", back_populates="patient")
    trial_matches = relationship("TrialMatch", back_populates="patient")
    audit_logs = relationship("AuditLog", back_populates="patient")


class PriorAuthorization(Base):
    __tablename__ = "prior_authorizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    reference_number = Column(String(50), unique=True, nullable=False)
    procedure_code = Column(String(20))
    procedure_name = Column(String(500))
    diagnosis_codes = Column(JSON, default=list)
    urgency = Column(String(20), default="routine")
    payer_name = Column(String(200))
    payer_id = Column(String(100))
    policy_criteria = Column(JSON, default=dict)
    necessity_letter = Column(Text)
    evidence_mapping = Column(JSON, default=dict)
    approval_probability = Column(Float, default=0.0)
    ai_reasoning = Column(Text)
    status = Column(SAEnum(AuthorizationStatus), default=AuthorizationStatus.PENDING)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    decision_at = Column(DateTime(timezone=True), nullable=True)
    denial_reason = Column(Text, nullable=True)
    appeal_letter = Column(Text, nullable=True)
    appeal_submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    patient = relationship("Patient", back_populates="prior_auths")


class ClinicalTrial(Base):
    __tablename__ = "clinical_trials"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nct_id = Column(String(20), unique=True, nullable=False, index=True)
    title = Column(String(1000), nullable=False)
    official_title = Column(Text)
    status = Column(String(50))
    phase = Column(String(50))
    sponsor = Column(String(500))
    condition = Column(JSON, default=list)
    intervention_type = Column(String(100))
    intervention_name = Column(String(500))
    eligibility_criteria = Column(Text)
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    gender_eligible = Column(String(10), default="all")
    locations = Column(JSON, default=list)
    enrollment_count = Column(Integer, nullable=True)
    primary_outcomes = Column(JSON, default=list)
    last_updated = Column(DateTime, nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    matches = relationship("TrialMatch", back_populates="trial")


class TrialMatch(Base):
    __tablename__ = "trial_matches"
    __table_args__ = (
        # FIXED: unique constraint prevents duplicate patient+trial matches
        UniqueConstraint("patient_id", "trial_id", name="uq_trial_match_patient_trial"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    trial_id = Column(UUID(as_uuid=True), ForeignKey("clinical_trials.id"), nullable=False)
    match_score = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    status = Column(SAEnum(TrialMatchStatus), default=TrialMatchStatus.POSSIBLY_ELIGIBLE)
    inclusion_met = Column(JSON, default=list)
    exclusion_met = Column(JSON, default=list)
    missing_criteria = Column(JSON, default=list)
    reasoning = Column(Text)
    patient_summary = Column(Text)
    patient_summary_hindi = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    patient = relationship("Patient", back_populates="trial_matches")
    trial = relationship("ClinicalTrial", back_populates="matches")


class AgentSession(Base):
    __tablename__ = "agent_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    session_type = Column(String(100))
    status = Column(SAEnum(AgentStatus), default=AgentStatus.IDLE)
    workflow_state = Column(JSON, default=dict)
    agent_events = Column(JSON, default=list)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    session_id = Column(String(100), nullable=True)
    action = Column(String(200), nullable=False)
    resource_type = Column(String(100))
    resource_id = Column(String(100))
    agent_name = Column(String(100))
    details = Column(JSON, default=dict)
    outcome = Column(String(50))
    phi_accessed = Column(Boolean, default=False)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    patient = relationship("Patient", back_populates="audit_logs")
