"""
FHIR service for IntelliCare Nexus.
Handles FHIR R4 bundle creation, parsing, and HAPI FHIR server integration.
"""
import httpx
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.core.config import settings
import structlog

logger = structlog.get_logger()


class FHIRService:
    """Service for FHIR R4 operations."""

    def __init__(self):
        self.base_url = settings.FHIR_SERVER_URL
        self.client = httpx.AsyncClient(timeout=30.0)

    def build_patient_fhir_bundle(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Build a FHIR R4 Bundle from patient data."""
        patient_id = str(patient_data.get("id", ""))
        entries = []

        # Patient resource
        patient_resource = {
            "resourceType": "Patient",
            "id": patient_id,
            "identifier": [
                {
                    "system": "urn:oid:2.16.840.1.113883.4.1",
                    "value": patient_data.get("mrn", "")
                }
            ],
            "name": [
                {
                    "use": "official",
                    "family": patient_data.get("last_name", ""),
                    "given": [patient_data.get("first_name", "")]
                }
            ],
            "gender": patient_data.get("gender", "unknown"),
            "birthDate": patient_data.get("date_of_birth", "")[:10] if patient_data.get("date_of_birth") else "",
            "telecom": [],
            "communication": [
                {
                    "language": {
                        "coding": [
                            {
                                "system": "urn:ietf:bcp:47",
                                "code": patient_data.get("language_preference", "en")
                            }
                        ]
                    }
                }
            ]
        }

        if patient_data.get("phone"):
            patient_resource["telecom"].append({
                "system": "phone",
                "value": patient_data["phone"]
            })

        entries.append({
            "fullUrl": f"Patient/{patient_id}",
            "resource": patient_resource
        })

        # Condition resources (diagnoses)
        for i, code in enumerate(patient_data.get("diagnosis_codes", [])):
            condition = {
                "resourceType": "Condition",
                "id": f"condition-{i}",
                "subject": {"reference": f"Patient/{patient_id}"},
                "code": {
                    "coding": [
                        {
                            "system": "http://hl7.org/fhir/sid/icd-10",
                            "code": code,
                            "display": patient_data.get("primary_diagnosis", code)
                        }
                    ]
                },
                "clinicalStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                            "code": "active"
                        }
                    ]
                },
                "verificationStatus": {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                            "code": "confirmed"
                        }
                    ]
                }
            }
            entries.append({
                "fullUrl": f"Condition/condition-{i}",
                "resource": condition
            })

        # MedicationRequest resources
        for i, med in enumerate(patient_data.get("medications", [])):
            med_request = {
                "resourceType": "MedicationRequest",
                "id": f"medreq-{i}",
                "status": "active",
                "intent": "order",
                "subject": {"reference": f"Patient/{patient_id}"},
                "medicationCodeableConcept": {
                    "coding": [
                        {
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "display": med.get("name", "")
                        }
                    ],
                    "text": med.get("name", "")
                },
                "dosageInstruction": [
                    {
                        "text": f"{med.get('dose', '')} {med.get('frequency', '')}"
                    }
                ]
            }
            entries.append({
                "fullUrl": f"MedicationRequest/medreq-{i}",
                "resource": med_request
            })

        # Observation resources (labs)
        for i, lab in enumerate(patient_data.get("lab_results", [])):
            observation = {
                "resourceType": "Observation",
                "id": f"obs-{i}",
                "status": "final",
                "subject": {"reference": f"Patient/{patient_id}"},
                "code": {
                    "text": lab.get("test", lab.get("name", ""))
                },
                "valueString": str(lab.get("value", "")),
                "effectiveDateTime": lab.get("date", datetime.now().isoformat())
            }
            entries.append({
                "fullUrl": f"Observation/obs-{i}",
                "resource": observation
            })

        # Coverage resource (insurance)
        if patient_data.get("insurance_provider"):
            coverage = {
                "resourceType": "Coverage",
                "id": "coverage-1",
                "status": "active",
                "beneficiary": {"reference": f"Patient/{patient_id}"},
                "payor": [
                    {
                        "display": patient_data.get("insurance_provider", "")
                    }
                ],
                "identifier": [
                    {
                        "value": patient_data.get("insurance_policy_number", "")
                    }
                ]
            }
            entries.append({
                "fullUrl": "Coverage/coverage-1",
                "resource": coverage
            })

        return {
            "resourceType": "Bundle",
            "id": f"bundle-{patient_id}",
            "type": "collection",
            "timestamp": datetime.now().isoformat(),
            "entry": entries
        }

    async def fetch_patient_from_fhir_server(self, fhir_patient_id: str) -> Optional[Dict[str, Any]]:
        """Fetch patient data from HAPI FHIR server."""
        try:
            url = f"{self.base_url}/Patient/{fhir_patient_id}/$everything"
            response = await self.client.get(
                url,
                headers={"Accept": "application/fhir+json"}
            )
            if response.status_code == 200:
                return response.json()
            logger.warning("FHIR patient not found", patient_id=fhir_patient_id, status=response.status_code)
            return None
        except Exception as e:
            logger.error("FHIR fetch error", error=str(e))
            return None

    def extract_key_clinical_data(self, fhir_bundle: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key clinical data from FHIR bundle for AI processing."""
        extracted = {
            "patient": {},
            "diagnoses": [],
            "medications": [],
            "labs": [],
            "procedures": [],
            "insurance": {}
        }

        entries = fhir_bundle.get("entry", [])
        for entry in entries:
            resource = entry.get("resource", {})
            resource_type = resource.get("resourceType", "")

            if resource_type == "Patient":
                name = resource.get("name", [{}])[0]
                extracted["patient"] = {
                    "id": resource.get("id"),
                    "name": f"{' '.join(name.get('given', []))} {name.get('family', '')}".strip(),
                    "gender": resource.get("gender"),
                    "birthDate": resource.get("birthDate"),
                }

            elif resource_type == "Condition":
                coding = resource.get("code", {}).get("coding", [{}])[0]
                extracted["diagnoses"].append({
                    "code": coding.get("code"),
                    "description": coding.get("display") or resource.get("code", {}).get("text"),
                    "status": resource.get("clinicalStatus", {}).get("coding", [{}])[0].get("code")
                })

            elif resource_type == "MedicationRequest":
                med_concept = resource.get("medicationCodeableConcept", {})
                extracted["medications"].append({
                    "name": med_concept.get("text") or med_concept.get("coding", [{}])[0].get("display"),
                    "status": resource.get("status"),
                    "dosage": resource.get("dosageInstruction", [{}])[0].get("text")
                })

            elif resource_type == "Observation":
                extracted["labs"].append({
                    "test": resource.get("code", {}).get("text"),
                    "value": resource.get("valueString") or resource.get("valueQuantity", {}).get("value"),
                    "unit": resource.get("valueQuantity", {}).get("unit"),
                    "date": resource.get("effectiveDateTime")
                })

            elif resource_type == "Coverage":
                extracted["insurance"] = {
                    "provider": resource.get("payor", [{}])[0].get("display"),
                    "policy_number": resource.get("identifier", [{}])[0].get("value"),
                    "status": resource.get("status")
                }

        return extracted


fhir_service = FHIRService()
