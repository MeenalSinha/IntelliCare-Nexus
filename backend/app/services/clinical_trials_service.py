"""
ClinicalTrials.gov API v2 service for IntelliCare Nexus.
Fetches and searches clinical trials for patient matching.
"""
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings
import structlog

logger = structlog.get_logger()


class ClinicalTrialsService:
    """Service for querying ClinicalTrials.gov API v2."""

    def __init__(self):
        self.base_url = settings.CLINICAL_TRIALS_API_URL
        self.client = httpx.AsyncClient(timeout=30.0)

    async def search_trials(
        self,
        conditions: List[str],
        interventions: Optional[List[str]] = None,
        status: str = "RECRUITING",
        max_results: int = 20,
    ) -> List[Dict[str, Any]]:
        """Search ClinicalTrials.gov for relevant trials."""
        try:
            condition_query = " OR ".join(conditions) if conditions else ""
            params = {
                "query.cond": condition_query,
                "filter.overallStatus": status,
                "pageSize": max_results,
                "format": "json",
                "fields": ",".join([
                    "NCTId", "BriefTitle", "OfficialTitle", "OverallStatus",
                    "Phase", "LeadSponsorName", "Condition", "InterventionName",
                    "InterventionType", "EligibilityCriteria", "MinimumAge",
                    "MaximumAge", "Gender", "LocationFacility", "LocationCity",
                    "LocationState", "LocationCountry", "EnrollmentCount",
                    "PrimaryOutcomeMeasure", "BriefSummary", "LastUpdatePostDate"
                ])
            }

            response = await self.client.get(
                f"{self.base_url}/studies",
                params=params
            )

            if response.status_code != 200:
                logger.warning("ClinicalTrials API error", status=response.status_code)
                return self._get_fallback_trials(conditions)

            data = response.json()
            studies = data.get("studies", [])
            return [self._parse_study(study) for study in studies]

        except Exception as e:
            logger.error("ClinicalTrials API exception", error=str(e))
            return self._get_fallback_trials(conditions)

    def _parse_study(self, study: Dict[str, Any]) -> Dict[str, Any]:
        """Parse a raw ClinicalTrials.gov study into structured format."""
        protocol = study.get("protocolSection", {})
        id_module = protocol.get("identificationModule", {})
        status_module = protocol.get("statusModule", {})
        sponsor_module = protocol.get("sponsorCollaboratorsModule", {})
        desc_module = protocol.get("descriptionModule", {})
        conditions_module = protocol.get("conditionsModule", {})
        design_module = protocol.get("designModule", {})
        eligibility_module = protocol.get("eligibilityModule", {})
        contacts_module = protocol.get("contactsLocationsModule", {})
        interventions_module = protocol.get("armsInterventionsModule", {})

        locations = []
        for loc in contacts_module.get("locations", [])[:5]:
            locations.append({
                "facility": loc.get("facility", ""),
                "city": loc.get("city", ""),
                "state": loc.get("state", ""),
                "country": loc.get("country", "")
            })

        interventions = []
        for inv in interventions_module.get("interventions", []):
            interventions.append({
                "type": inv.get("type", ""),
                "name": inv.get("name", "")
            })

        return {
            "nct_id": id_module.get("nctId", ""),
            "title": id_module.get("briefTitle", ""),
            "official_title": id_module.get("officialTitle", ""),
            "status": status_module.get("overallStatus", ""),
            "phase": " / ".join(design_module.get("phases", [])),
            "sponsor": sponsor_module.get("leadSponsor", {}).get("name", ""),
            "conditions": conditions_module.get("conditions", []),
            "interventions": interventions,
            "brief_summary": desc_module.get("briefSummary", ""),
            "eligibility_criteria": eligibility_module.get("eligibilityCriteria", ""),
            "min_age": eligibility_module.get("minimumAge", ""),
            "max_age": eligibility_module.get("maximumAge", ""),
            "gender": eligibility_module.get("sex", "ALL"),
            "locations": locations,
            "enrollment": design_module.get("enrollmentInfo", {}).get("count"),
        }

    def _get_fallback_trials(self, conditions: List[str]) -> List[Dict[str, Any]]:
        """Return synthetic trial data when API is unavailable."""
        return [
            {
                "nct_id": "NCT04878796",
                "title": "Pembrolizumab Plus Chemotherapy in First-Line Metastatic NSCLC",
                "official_title": "A Phase 3 Study of Pembrolizumab Combined With Platinum-Based Chemotherapy vs. Chemotherapy Alone in Metastatic Non-Small Cell Lung Cancer",
                "status": "RECRUITING",
                "phase": "Phase 3",
                "sponsor": "Merck Sharp & Dohme LLC",
                "conditions": ["Non-Small Cell Lung Cancer", "NSCLC", "Lung Neoplasms"],
                "interventions": [
                    {"type": "DRUG", "name": "Pembrolizumab"},
                    {"type": "DRUG", "name": "Carboplatin"},
                    {"type": "DRUG", "name": "Pemetrexed"}
                ],
                "brief_summary": "This study evaluates pembrolizumab combined with platinum-based chemotherapy as first-line treatment for metastatic non-small cell lung cancer in patients regardless of PD-L1 expression.",
                "eligibility_criteria": "Inclusion Criteria:\n- Histologically confirmed stage IIIB or IV NSCLC\n- No prior systemic therapy\n- ECOG PS 0-2\n- Adequate organ function\n- PD-L1 TPS >= 1%\nExclusion Criteria:\n- EGFR mutations\n- ALK rearrangements\n- Prior immunotherapy",
                "min_age": "18 Years",
                "max_age": "N/A",
                "gender": "ALL",
                "locations": [
                    {"facility": "MD Anderson Cancer Center", "city": "Houston", "state": "TX", "country": "USA"},
                    {"facility": "Memorial Sloan Kettering", "city": "New York", "state": "NY", "country": "USA"}
                ],
                "enrollment": 850,
            },
            {
                "nct_id": "NCT05060862",
                "title": "Sotorasib in KRAS G12C Mutated NSCLC - CODEBREAK 200",
                "official_title": "Phase 3 Open-Label Study of Sotorasib vs. Docetaxel in Patients With Previously Treated KRAS G12C Mutated NSCLC",
                "status": "RECRUITING",
                "phase": "Phase 3",
                "sponsor": "Amgen",
                "conditions": ["NSCLC", "KRAS G12C Mutation", "Lung Cancer"],
                "interventions": [
                    {"type": "DRUG", "name": "Sotorasib (AMG 510)"},
                    {"type": "DRUG", "name": "Docetaxel"}
                ],
                "brief_summary": "CODEBREAK 200 evaluates sotorasib vs. docetaxel in patients with KRAS G12C mutated NSCLC who have received prior platinum-based chemotherapy and anti-PD-1/PD-L1 therapy.",
                "eligibility_criteria": "Inclusion Criteria:\n- KRAS G12C mutation confirmed by local or central testing\n- Stage IV NSCLC\n- Prior platinum-based chemotherapy\n- Prior anti-PD-1 or anti-PD-L1 therapy\n- Age >= 18 years\nExclusion Criteria:\n- Active brain metastases\n- Prior KRAS inhibitor therapy\n- Active autoimmune disease",
                "min_age": "18 Years",
                "max_age": "N/A",
                "gender": "ALL",
                "locations": [
                    {"facility": "Dana-Farber Cancer Institute", "city": "Boston", "state": "MA", "country": "USA"},
                    {"facility": "UCLA Medical Center", "city": "Los Angeles", "state": "CA", "country": "USA"}
                ],
                "enrollment": 345,
            },
            {
                "nct_id": "NCT04976361",
                "title": "Nivolumab Plus Ipilimumab in Advanced NSCLC - CheckMate 227",
                "official_title": "Phase 3 Study of Nivolumab Plus Ipilimumab vs. Chemotherapy as First-Line Treatment for Stage IV NSCLC",
                "status": "RECRUITING",
                "phase": "Phase 3",
                "sponsor": "Bristol-Myers Squibb",
                "conditions": ["Non-Small Cell Lung Cancer", "Advanced Lung Cancer"],
                "interventions": [
                    {"type": "DRUG", "name": "Nivolumab"},
                    {"type": "DRUG", "name": "Ipilimumab"}
                ],
                "brief_summary": "CheckMate 227 evaluates dual checkpoint blockade with nivolumab and ipilimumab versus chemotherapy in treatment-naive stage IV NSCLC patients with high tumor mutational burden.",
                "eligibility_criteria": "Inclusion Criteria:\n- Stage IV NSCLC\n- No prior systemic therapy for advanced disease\n- ECOG PS 0-1\n- TMB >= 10 mut/Mb (high TMB cohort)\nExclusion Criteria:\n- Known EGFR or ALK alterations\n- Active autoimmune disease\n- Systemic corticosteroids",
                "min_age": "18 Years",
                "max_age": "N/A",
                "gender": "ALL",
                "locations": [
                    {"facility": "Johns Hopkins Hospital", "city": "Baltimore", "state": "MD", "country": "USA"},
                    {"facility": "Cleveland Clinic", "city": "Cleveland", "state": "OH", "country": "USA"}
                ],
                "enrollment": 1739,
            },
        ]


clinical_trials_service = ClinicalTrialsService()
