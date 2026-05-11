"""
Backend API tests for IntelliCare Nexus.
Tests patient CRUD, prior auth, and agent orchestration endpoints.
"""
import pytest
import uuid
from datetime import datetime
from httpx import AsyncClient
from app.main import app
from app.core.security import create_access_token


@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": str(uuid.uuid4()), "email": "test@test.com", "role": "physician"})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert "IntelliCare" in response.json()["message"]


@pytest.mark.asyncio
async def test_list_patients_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/patients/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_prior_auths_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/prior-auth/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_analytics_requires_auth():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_fhir_service_builds_bundle():
    from app.services.fhir_service import fhir_service
    patient_data = {
        "id": str(uuid.uuid4()),
        "mrn": "TEST-001",
        "first_name": "Test",
        "last_name": "Patient",
        "date_of_birth": "1970-01-01",
        "gender": "male",
        "diagnosis_codes": ["C34.10"],
        "primary_diagnosis": "Lung cancer",
        "medications": [{"name": "Pembrolizumab", "dose": "200mg", "frequency": "Q3W", "route": "IV"}],
        "lab_results": [{"test": "PD-L1", "value": "85%", "date": "2024-01-01"}],
        "insurance_provider": "TestPayer",
        "insurance_policy_number": "TEST-123",
        "language_preference": "en",
    }
    bundle = fhir_service.build_patient_fhir_bundle(patient_data)
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert len(bundle["entry"]) >= 1
    patient_resource = next(e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == "Patient")
    assert patient_resource["name"][0]["family"] == "Patient"


@pytest.mark.asyncio
async def test_fhir_extract_key_clinical_data():
    from app.services.fhir_service import fhir_service
    patient_data = {
        "id": "test-id",
        "mrn": "TEST-002",
        "first_name": "Jane",
        "last_name": "Doe",
        "date_of_birth": "1980-05-10",
        "gender": "female",
        "diagnosis_codes": ["C50.911"],
        "primary_diagnosis": "Breast cancer",
        "medications": [],
        "lab_results": [],
        "insurance_provider": "Aetna",
        "insurance_policy_number": "AET-999",
        "language_preference": "en",
    }
    bundle = fhir_service.build_patient_fhir_bundle(patient_data)
    extracted = fhir_service.extract_key_clinical_data(bundle)
    assert "patient" in extracted
    assert "diagnoses" in extracted
    assert "medications" in extracted


def test_security_token_creation():
    from app.core.security import create_access_token, decode_token
    data = {"sub": "user-123", "email": "test@test.com"}
    token = create_access_token(data)
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "test@test.com"


def test_risk_score_calculation():
    from app.api.patients import _calculate_risk_score
    high_risk = _calculate_risk_score({
        "diagnosis_codes": ["C34.10"],
        "medications": [{"name": "med1"}, {"name": "med2"}, {"name": "med3"},
                        {"name": "med4"}, {"name": "med5"}, {"name": "med6"}],
        "genomics": {"KRAS": "G12C"},
    })
    assert high_risk >= 0.6

    low_risk = _calculate_risk_score({
        "diagnosis_codes": ["J44.1"],
        "medications": [],
        "genomics": {},
    })
    assert low_risk < high_risk


def test_utils_functions():
    from app.api.patients import _calculate_age
    age = _calculate_age(datetime(1966, 3, 15))
    assert 55 <= age <= 70
