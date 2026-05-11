"""
Synthetic patient data seeding script for IntelliCare Nexus.
Creates realistic healthcare demo data including the lung cancer demo patient.
"""
import asyncio
import uuid
from datetime import datetime, date
from app.core.database import create_tables, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import User, Patient, PriorAuthorization, AuthorizationStatus
from app.services.fhir_service import fhir_service
import structlog

logger = structlog.get_logger()


DEMO_PATIENTS = [
    {
        "mrn": "ICN-001-2024",
        "first_name": "Arjun",
        "last_name": "Sharma",
        "date_of_birth": datetime(1966, 3, 15),
        "gender": "male",
        "phone": "+1-555-0101",
        "email": "arjun.sharma@demo.com",
        "language_preference": "hi",
        "insurance_provider": "UnitedHealthcare",
        "insurance_policy_number": "UHC-8847291",
        "insurance_group_number": "GRP-450012",
        "primary_diagnosis": "Non-small cell lung cancer, stage IIIB",
        "diagnosis_codes": ["C34.10", "Z96.89"],
        "medications": [
            {"name": "Pembrolizumab (Keytruda)", "dose": "200mg", "frequency": "Q3W", "route": "IV"},
            {"name": "Carboplatin", "dose": "AUC 6", "frequency": "Q3W", "route": "IV"},
            {"name": "Pemetrexed", "dose": "500mg/m2", "frequency": "Q3W", "route": "IV"},
            {"name": "Ondansetron", "dose": "8mg", "frequency": "PRN", "route": "PO"},
            {"name": "Dexamethasone", "dose": "4mg", "frequency": "BID", "route": "PO"},
        ],
        "allergies": ["Penicillin", "Sulfonamides"],
        "lab_results": [
            {"test": "PD-L1 TPS", "value": "85%", "date": "2024-01-15", "significance": "high - excellent immunotherapy candidate"},
            {"test": "Hemoglobin", "value": "10.2 g/dL", "date": "2024-01-20", "significance": "mild anemia"},
            {"test": "Creatinine", "value": "0.9 mg/dL", "date": "2024-01-20", "significance": "normal renal function"},
            {"test": "ALT", "value": "32 U/L", "date": "2024-01-20", "significance": "normal hepatic function"},
            {"test": "WBC", "value": "6.2 x10^9/L", "date": "2024-01-20", "significance": "normal"},
            {"test": "Platelets", "value": "218 x10^9/L", "date": "2024-01-20", "significance": "normal"},
            {"test": "TMB", "value": "15 mut/Mb", "date": "2024-01-10", "significance": "high TMB - favorable for immunotherapy"},
        ],
        "genomics": {
            "KRAS": "G12C mutation detected",
            "EGFR": "wild-type",
            "ALK": "negative",
            "ROS1": "negative",
            "PD-L1": "85% TPS",
            "TMB": "15 mut/Mb (high)",
            "STK11": "wild-type",
            "KEAP1": "wild-type",
        },
        "vital_signs": {
            "ecog_ps": "1",
            "weight": "72 kg",
            "height": "175 cm",
            "bsa": "1.88 m2",
            "blood_pressure": "128/82",
            "heart_rate": "76",
        },
        "procedures": [
            {"name": "CT Chest/Abdomen/Pelvis", "date": "2024-01-10", "result": "Stage IIIB NSCLC with mediastinal lymph node involvement"},
            {"name": "PET Scan", "date": "2024-01-12", "result": "Hypermetabolic primary lung lesion and N2 nodes, no distant metastases"},
            {"name": "CT-guided Lung Biopsy", "date": "2023-12-20", "result": "Adenocarcinoma, KRAS G12C, PD-L1 85%"},
            {"name": "Brain MRI (REQUIRED)", "code": "70553", "urgency": "urgent", "date": None, "result": "Authorization pending"},
        ],
        "risk_score": 0.85,
        "risk_level": "critical",
    },
    {
        "mrn": "ICN-002-2024",
        "first_name": "Priya",
        "last_name": "Patel",
        "date_of_birth": datetime(1978, 8, 22),
        "gender": "female",
        "phone": "+1-555-0202",
        "email": "priya.patel@demo.com",
        "language_preference": "en",
        "insurance_provider": "Aetna",
        "insurance_policy_number": "AET-5530981",
        "primary_diagnosis": "Breast cancer, HER2-positive, stage II",
        "diagnosis_codes": ["C50.911", "Z17.0"],
        "medications": [
            {"name": "Trastuzumab (Herceptin)", "dose": "6mg/kg", "frequency": "Q3W", "route": "IV"},
            {"name": "Pertuzumab (Perjeta)", "dose": "420mg", "frequency": "Q3W", "route": "IV"},
            {"name": "Docetaxel", "dose": "75mg/m2", "frequency": "Q3W", "route": "IV"},
        ],
        "allergies": [],
        "lab_results": [
            {"test": "HER2/neu IHC", "value": "3+ positive", "date": "2024-02-01"},
            {"test": "ER/PR", "value": "ER 90%, PR 45%", "date": "2024-02-01"},
            {"test": "Ki-67", "value": "35%", "date": "2024-02-01"},
        ],
        "genomics": {
            "HER2": "amplified (FISH ratio 4.2)",
            "BRCA1": "wild-type",
            "BRCA2": "wild-type",
            "PIK3CA": "H1047R mutation",
        },
        "vital_signs": {"ecog_ps": "0", "weight": "63 kg"},
        "procedures": [
            {"name": "Core Needle Biopsy", "date": "2024-01-25", "result": "Invasive ductal carcinoma, HER2+"},
            {"name": "Breast MRI", "date": "2024-01-28", "result": "2.3cm primary tumor, no axillary involvement"},
        ],
        "risk_score": 0.65,
        "risk_level": "high",
    },
    {
        "mrn": "ICN-003-2024",
        "first_name": "David",
        "last_name": "Chen",
        "date_of_birth": datetime(1955, 11, 30),
        "gender": "male",
        "phone": "+1-555-0303",
        "email": "david.chen@demo.com",
        "language_preference": "en",
        "insurance_provider": "Cigna",
        "insurance_policy_number": "CIG-7721034",
        "primary_diagnosis": "Type 2 diabetes mellitus with diabetic nephropathy",
        "diagnosis_codes": ["E11.65", "N18.3"],
        "medications": [
            {"name": "Empagliflozin (Jardiance)", "dose": "10mg", "frequency": "daily", "route": "PO"},
            {"name": "Metformin", "dose": "1000mg", "frequency": "BID", "route": "PO"},
            {"name": "Lisinopril", "dose": "20mg", "frequency": "daily", "route": "PO"},
        ],
        "allergies": ["Contrast dye - relative contraindication"],
        "lab_results": [
            {"test": "HbA1c", "value": "8.9%", "date": "2024-01-30", "significance": "poorly controlled"},
            {"test": "eGFR", "value": "42 mL/min/1.73m2", "date": "2024-01-30", "significance": "CKD stage 3b"},
            {"test": "Urine Albumin/Creatinine", "value": "380 mg/g", "date": "2024-01-30"},
        ],
        "genomics": {},
        "vital_signs": {"blood_pressure": "148/92", "weight": "96 kg"},
        "procedures": [],
        "risk_score": 0.55,
        "risk_level": "medium",
    },
    {
        "mrn": "ICN-004-2024",
        "first_name": "Maria",
        "last_name": "Rodriguez",
        "date_of_birth": datetime(1962, 5, 14),
        "gender": "female",
        "phone": "+1-555-0404",
        "email": "maria.rodriguez@demo.com",
        "language_preference": "en",
        "insurance_provider": "BlueCross BlueShield",
        "insurance_policy_number": "BCBS-3310092",
        "primary_diagnosis": "Multiple sclerosis, relapsing-remitting",
        "diagnosis_codes": ["G35", "G35.9"],
        "medications": [
            {"name": "Natalizumab (Tysabri)", "dose": "300mg", "frequency": "Q4W", "route": "IV"},
            {"name": "Baclofen", "dose": "10mg", "frequency": "TID", "route": "PO"},
        ],
        "allergies": ["NSAIDs"],
        "lab_results": [
            {"test": "JC Virus Antibody Index", "value": "0.43", "date": "2024-01-15", "significance": "negative"},
            {"test": "MRI Brain (annual)", "value": "No new T2 lesions", "date": "2024-01-20"},
        ],
        "genomics": {},
        "vital_signs": {"ecog_ps": "1", "edss": "3.0"},
        "procedures": [
            {"name": "MRI Brain and Spine", "date": "2024-01-20", "result": "Stable MS plaques, no enhancement"},
        ],
        "risk_score": 0.45,
        "risk_level": "medium",
    },
    {
        "mrn": "ICN-005-2024",
        "first_name": "James",
        "last_name": "Williams",
        "date_of_birth": datetime(1948, 2, 8),
        "gender": "male",
        "phone": "+1-555-0505",
        "email": "james.williams@demo.com",
        "language_preference": "en",
        "insurance_provider": "Medicare",
        "insurance_policy_number": "MED-A2B3C4D5",
        "primary_diagnosis": "Chronic obstructive pulmonary disease, severe",
        "diagnosis_codes": ["J44.1", "J44.9"],
        "medications": [
            {"name": "Tiotropium (Spiriva)", "dose": "18mcg", "frequency": "daily", "route": "inhaled"},
            {"name": "Budesonide/Formoterol (Symbicort)", "dose": "320/9mcg", "frequency": "BID", "route": "inhaled"},
            {"name": "Albuterol", "dose": "2.5mg", "frequency": "PRN", "route": "nebulized"},
        ],
        "allergies": [],
        "lab_results": [
            {"test": "FEV1", "value": "45% predicted", "date": "2024-01-25", "significance": "severe obstruction"},
            {"test": "DLCO", "value": "52% predicted", "date": "2024-01-25"},
            {"test": "SpO2", "value": "91% on room air", "date": "2024-01-25"},
            {"test": "6-Minute Walk Test", "value": "280 meters", "date": "2024-01-25"},
        ],
        "genomics": {},
        "vital_signs": {"blood_pressure": "135/85", "weight": "78 kg", "spo2": "91"},
        "procedures": [],
        "risk_score": 0.62,
        "risk_level": "high",
    }
]


async def seed_database():
    """Seed the database with demo users and synthetic patients."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        # Create demo users
        users_data = [
            {
                "email": "demo@intellicare.ai",
                "full_name": "Dr. Sophia Chen",
                "role": "physician",
                "password": "Demo@2024",
            },
            {
                "email": "admin@intellicare.ai",
                "full_name": "Admin User",
                "role": "admin",
                "password": "Admin@2024",
            },
            {
                "email": "coordinator@intellicare.ai",
                "full_name": "Sarah Johnson",
                "role": "coordinator",
                "password": "Coord@2024",
            },
        ]

        for user_data in users_data:
            from sqlalchemy import select
            existing = await db.execute(select(User).where(User.email == user_data["email"]))
            if existing.scalar_one_or_none():
                continue

            user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                role=user_data["role"],
                hashed_password=get_password_hash(user_data["password"]),
            )
            db.add(user)

        await db.flush()
        logger.info("Demo users created")

        # Create synthetic patients
        created_count = 0
        for patient_data in DEMO_PATIENTS:
            from sqlalchemy import select
            existing = await db.execute(select(Patient).where(Patient.mrn == patient_data["mrn"]))
            if existing.scalar_one_or_none():
                continue

            patient = Patient(**patient_data)
            db.add(patient)
            await db.flush()

            # Generate FHIR bundle
            patient_dict = {
                "id": str(patient.id),
                **{k: v for k, v in patient_data.items()},
                "date_of_birth": patient_data["date_of_birth"].isoformat(),
            }
            fhir_bundle = fhir_service.build_patient_fhir_bundle(patient_dict)
            patient.fhir_bundle = fhir_bundle

            # Create a sample prior auth for the lung cancer patient
            if patient_data["mrn"] == "ICN-001-2024":
                prior_auth = PriorAuthorization(
                    patient_id=patient.id,
                    reference_number=f"ICN-{datetime.now().year}-PA001",
                    procedure_code="70553",
                    procedure_name="MRI Brain with and without Contrast",
                    diagnosis_codes=["C34.10"],
                    urgency="urgent",
                    payer_name="UnitedHealthcare",
                    payer_id="UHC",
                    status=AuthorizationStatus.SUBMITTED,
                    submitted_at=datetime.now(),
                    approval_probability=0.82,
                    necessity_letter="[AI-generated necessity letter - run agent workflow to generate full letter]",
                    ai_reasoning="Patient with stage IIIB NSCLC requires MRI brain with contrast for staging evaluation and treatment planning before initiating immunotherapy.",
                    evidence_mapping={
                        "diagnosis": {"requirement": "Active cancer diagnosis", "evidence": "NSCLC Stage IIIB confirmed by biopsy", "met": True},
                        "clinical_need": {"requirement": "Medical necessity for imaging", "evidence": "Pre-immunotherapy staging required", "met": True},
                    }
                )
                db.add(prior_auth)

                prior_auth2 = PriorAuthorization(
                    patient_id=patient.id,
                    reference_number=f"ICN-{datetime.now().year}-PA002",
                    procedure_code="J9271",
                    procedure_name="Pembrolizumab 200mg IV Infusion",
                    diagnosis_codes=["C34.10"],
                    urgency="routine",
                    payer_name="UnitedHealthcare",
                    payer_id="UHC",
                    status=AuthorizationStatus.PENDING,
                    approval_probability=0.88,
                    policy_criteria={"criteria": ["PD-L1 >= 1% required", "No prior platinum chemotherapy"], "coverage": "covered_with_prior_auth"},
                )
                db.add(prior_auth2)

            created_count += 1

        await db.commit()
        logger.info(f"Seed complete: {created_count} patients created")
        print(f"Database seeded successfully with {created_count} patients and demo users.")
        print("\nDemo login credentials:")
        print("  Physician: demo@intellicare.ai / Demo@2024")
        print("  Admin:     admin@intellicare.ai / Admin@2024")


if __name__ == "__main__":
    asyncio.run(seed_database())
