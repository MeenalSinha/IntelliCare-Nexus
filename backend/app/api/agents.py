"""
Agent orchestration API endpoints and WebSocket handler for IntelliCare Nexus.
WebSocket uses token-based authentication via query parameter.
Background tasks receive primitive IDs only (no ORM objects).
"""
import uuid
import asyncio
import json
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user_id, decode_token
from app.core.redis_client import get_redis, get_agent_state
from app.models.models import Patient, AgentSession, AgentStatus
from app.schemas.schemas import AgentRunRequest, AgentSessionResponse
from app.agents.orchestrator import run_agent_workflow
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/run", status_code=202)
async def run_agents(
    request: AgentRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Trigger multi-agent workflow. Returns session_id for WebSocket connection."""
    patient_result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    session_id = str(uuid.uuid4())
    agent_session = AgentSession(
        id=uuid.UUID(session_id),
        patient_id=request.patient_id,
        session_type=request.workflow_type,
        status=AgentStatus.RUNNING,
        started_at=datetime.now(),
    )
    db.add(agent_session)
    await db.commit()

    # Serialize all data as primitives — no ORM objects passed to background tasks
    patient_data = {
        "id": str(patient.id),
        "mrn": patient.mrn,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else "",
        "gender": patient.gender or "",
        "primary_diagnosis": patient.primary_diagnosis or "",
        "diagnosis_codes": patient.diagnosis_codes or [],
        "medications": patient.medications or [],
        "allergies": patient.allergies or [],
        "lab_results": patient.lab_results or [],
        "genomics": patient.genomics or {},
        "vital_signs": patient.vital_signs or {},
        "procedures": patient.procedures or [],
        "insurance_provider": patient.insurance_provider or "",
        "insurance_policy_number": patient.insurance_policy_number or "",
        "risk_score": float(patient.risk_score or 0),
        "language_preference": patient.language_preference or "en",
        **(request.context or {}),
    }
    fhir_bundle = patient.fhir_bundle or {}

    # Add small delay so WebSocket client can connect before first events fire
    background_tasks.add_task(
        _run_workflow_background,
        session_id=session_id,
        patient_id=str(request.patient_id),
        patient_data=patient_data,
        workflow_type=request.workflow_type,
        fhir_bundle=fhir_bundle,
    )

    return {
        "session_id": session_id,
        "status": "started",
        "workflow_type": request.workflow_type,
        "patient_id": str(request.patient_id),
        "websocket_url": f"/ws/agents/{session_id}",
    }


@router.get("/session/{session_id}", response_model=AgentSessionResponse)
async def get_agent_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(AgentSession).where(AgentSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Agent session not found")
    return session


@router.get("/session/{session_id}/state")
async def get_session_state(
    session_id: str,
    _user_id: str = Depends(get_current_user_id),
):
    """Get full workflow state from Redis (1-hour TTL)."""
    state = await get_agent_state(session_id)
    if not state:
        raise HTTPException(
            status_code=404,
            detail="Session state not found. It may have expired (1-hour TTL) or the workflow has not started."
        )
    return state


# NOTE: WebSocket route is registered in main.py via app.add_websocket_route
# Do NOT add @router.websocket here to avoid duplicate routing.

async def websocket_agent_events(websocket: WebSocket, session_id: str, token: str = Query(default="")):
    """
    WebSocket endpoint for real-time agent event streaming.
    Authenticates via ?token= query parameter.
    """
    # Authenticate before accepting
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()
    logger.info("WebSocket connected", session_id=session_id)

    redis_client = await get_redis()
    pubsub = redis_client.pubsub()
    channel = f"agents:{session_id}"

    try:
        await pubsub.subscribe(channel)

        await websocket.send_json({
            "event_type": "connected",
            "session_id": session_id,
            "message": "Connected to IntelliCare Nexus agent stream",
            "timestamp": datetime.now().isoformat(),
        })

        consecutive_heartbeats = 0
        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=0.1
                )
                if message and message.get("type") == "message":
                    data = json.loads(message["data"])
                    await websocket.send_json(data)
                    consecutive_heartbeats = 0
                    if data.get("event_type") == "completed" and data.get("agent_name") == "Orchestrator":
                        await asyncio.sleep(0.5)
                        break
                    if data.get("event_type") == "failed":
                        await asyncio.sleep(0.5)
                        break
                else:
                    consecutive_heartbeats += 1
                    # Send heartbeat every ~5 seconds
                    if consecutive_heartbeats >= 50:
                        await websocket.send_json({
                            "event_type": "heartbeat",
                            "timestamp": datetime.now().isoformat(),
                        })
                        consecutive_heartbeats = 0
            except asyncio.TimeoutError:
                consecutive_heartbeats += 1
                if consecutive_heartbeats >= 50:
                    try:
                        await websocket.send_json({
                            "event_type": "heartbeat",
                            "timestamp": datetime.now().isoformat(),
                        })
                        consecutive_heartbeats = 0
                    except Exception:
                        break
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error("WebSocket error", error=str(e))
                break
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            pass
        logger.info("WebSocket disconnected", session_id=session_id)


async def _run_workflow_background(
    session_id: str,
    patient_id: str,
    patient_data: dict,
    workflow_type: str,
    fhir_bundle: dict,
):
    """Background task: runs agent workflow with fresh DB session, all primitives."""
    # Small delay allows WebSocket client to connect before first events fire
    await asyncio.sleep(0.8)

    from app.core.database import AsyncSessionLocal
    from app.core.redis_client import publish_agent_event

    async with AsyncSessionLocal() as db:
        try:
            final_state = await run_agent_workflow(
                session_id=session_id,
                patient_id=patient_id,
                patient_data=patient_data,
                workflow_type=workflow_type,
                fhir_bundle=fhir_bundle,
            )

            result = await db.execute(
                select(AgentSession).where(AgentSession.id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()
            if session:
                session.status = AgentStatus.COMPLETED
                session.completed_at = datetime.now()
                session.workflow_state = {
                    "completed_agents": final_state.get("completed_agents", []),
                    "approval_probability": final_state.get("approval_probability", 0),
                    "trial_matches_count": len(final_state.get("trial_matches", [])),
                    "errors": final_state.get("errors", []),
                    "tool_calls": len(final_state.get("tool_call_log", [])),
                }
                session.result = {
                    "necessity_letter_preview": (final_state.get("necessity_letter") or "")[:300],
                    "approval_probability": final_state.get("approval_probability", 0),
                    "trial_matches": len(final_state.get("trial_matches", [])),
                    "patient_summary_en_preview": (final_state.get("patient_summary_en") or "")[:200],
                    "care_plan": final_state.get("care_plan", {}),
                }
                session.agent_events = final_state.get("agent_events", [])
                await db.commit()

            logger.info("Workflow completed", session_id=session_id,
                        agents=len(final_state.get("completed_agents", [])))

        except Exception as e:
            logger.error("Background workflow failed", session_id=session_id, error=str(e))
            result = await db.execute(
                select(AgentSession).where(AgentSession.id == uuid.UUID(session_id))
            )
            session = result.scalar_one_or_none()
            if session:
                session.status = AgentStatus.FAILED
                session.error = str(e)
                session.completed_at = datetime.now()
                await db.commit()
            await publish_agent_event(session_id, {
                "event_type": "failed",
                "agent_name": "Orchestrator",
                "message": f"Workflow failed: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            })
