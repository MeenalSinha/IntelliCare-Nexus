# IntelliCare Nexus
## Autonomous Clinical Decision and Access Platform

A production-grade healthcare multi-agent AI platform that automates prior authorizations,
clinical trial matching, and care coordination using autonomous AI agents powered by Google Gemini 2.5.

---

## Architecture Overview

```
intellicare-nexus/
  frontend/          Next.js 15 TypeScript frontend
  backend/           FastAPI Python backend + agent framework
  infra/             Docker Compose + environment configs
  docs/              Architecture diagrams + API docs
  scripts/           Setup and seed scripts
```

---

## Tech Stack

### Frontend
- Next.js 15 + TypeScript
- TailwindCSS + custom design system
- Framer Motion (animations)
- React Flow (agent orchestration graph)
- Recharts (analytics)
- ShadCN UI components

### Backend
- FastAPI + Python 3.12
- LangGraph multi-agent framework
- Google Gemini 2.5 Flash (AI reasoning)
- HAPI FHIR integration
- ClinicalTrials.gov API integration

### Databases
- PostgreSQL (patient data, audit logs)
- Redis (real-time agent state, pub/sub)
- ChromaDB (vector embeddings for RAG)

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.12+
- Google Gemini API Key

### 1. Clone and configure environment

```bash
cp infra/.env.example infra/.env
# Edit infra/.env and add your GEMINI_API_KEY
```

### 2. Start all services with Docker

```bash
cd infra
docker-compose up --build
```

### 3. Seed synthetic patient data

```bash
docker exec intellicare-backend python -m scripts.seed_data
```

### 4. Access the platform

- Frontend:  http://localhost:3000
- Backend API: http://localhost:8000
- API Docs:  http://localhost:8000/docs
- Redis:     localhost:6379
- PostgreSQL: localhost:5432

### Demo Login
- Email: demo@intellicare.ai
- Password: Demo@2024

---

## Multi-Agent System

The platform uses 10 specialized AI agents orchestrated via LangGraph:

1. **ClinicalContextAgent** - Parses FHIR bundles, extracts structured patient data
2. **PriorAuthorizationAgent** - Detects auth requirements, coordinates payer workflow
3. **InsurancePolicyAgent** - Fetches and parses payer criteria
4. **MedicalNecessityAgent** - Generates clinical justification with step-by-step reasoning
5. **AppealAgent** - Auto-generates denial appeals with evidence
6. **ClinicalTrialMatchmakerAgent** - Queries ClinicalTrials.gov, parses eligibility
7. **EligibilityReasoningAgent** - Explains qualification with confidence scores
8. **PatientCommunicationAgent** - Multilingual (English/Hindi) patient summaries
9. **CareCoordinationAgent** - Handles referrals, tracks workflow state
10. **AuditComplianceAgent** - Logs all actions, generates compliance timeline

---

## MCP-Style Tool Suite

- `find_eligible_trials(patient_fhir_bundle)`
- `fetch_payer_policy(policy_id)`
- `generate_medical_necessity_letter(patient_id, diagnosis_code)`
- `parse_clinical_notes(note_text)`
- `calculate_approval_probability(auth_request)`
- `generate_patient_summary(patient_id, language)`
- `eligibility_reasoning(patient_id, trial_id)`
- `generate_appeal_letter(denial_id)`

---

## MCP Server (A2A Agent) & SHARP Extension Specs

The platform includes a dedicated Model Context Protocol (MCP) server implementation (`backend/app/mcp_server.py`) designed for A2A (Agent-to-Agent) communication.

**Compliance with Hackathon Requirements:**
1. **MCP Server built on own infrastructure:** Implemented using the standard Python `mcp` SDK, runnable locally.
2. **SHARP Extension Specs Integration:** Handled natively by accepting `patient_id` and `fhir_token` as context parameters to securely fetch and isolate patient data.
3. **FHIR Server Data:** Connects directly to public HAPI FHIR servers to execute data ingestion and perform medical necessity analysis based on live FHIR data.

To run the MCP server independently:
```bash
python -m backend.app.mcp_server
```

---

## API Documentation

Full OpenAPI docs available at `http://localhost:8000/docs` when running.

Key endpoints:
- `POST /api/v1/patients/` - Create patient
- `GET /api/v1/patients/{id}/fhir` - Get FHIR bundle
- `POST /api/v1/prior-auth/` - Submit authorization request
- `POST /api/v1/trials/match` - Find matching trials
- `POST /api/v1/agents/run` - Trigger agent workflow
- `GET /api/v1/agents/status/{session_id}` - Get agent run status
- `WebSocket /ws/agents/{session_id}` - Live agent updates

---

## Demo Mode

Press **Ctrl+Shift+D** anywhere in the UI to activate Hackathon Demo Mode.

The demo auto-runs the full lung cancer patient scenario:
1. FHIR record ingestion
2. Prior auth detection and generation
3. Clinical trial matching
4. Multilingual patient summary generation
5. Live agent orchestration visualization

---

## Environment Variables

See `infra/.env.example` for all required variables.

Required:
- `GEMINI_API_KEY` - Google Gemini 2.5 API key
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - JWT signing secret

---

## License

MIT License - Built for healthcare AI innovation.
