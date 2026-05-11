"""
IntelliCare Nexus — FastAPI Application Entry Point
Autonomous Clinical Decision and Access Platform
"""
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.api.patients import router as patients_router
from app.api.prior_auth import router as prior_auth_router
from app.api.agents import router as agents_router, websocket_agent_events
from app.api.trials import router as trials_router
from app.api.auth_analytics import auth_router, analytics_router
from app.api.tools import router as tools_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("IntelliCare Nexus starting up", version=settings.APP_VERSION)
    await create_tables()
    logger.info("Database tables initialized")

    # Validate Gemini API key at startup (non-blocking warning)
    if settings.GEMINI_API_KEY:
        from app.services.gemini_service import check_gemini_health
        health = await check_gemini_health()
        if health["status"] == "healthy":
            logger.info("Gemini API key validated successfully")
        else:
            logger.warning("Gemini API health check failed", error=health.get("error"))
    else:
        logger.warning("GEMINI_API_KEY not set — AI features will be limited")

    yield
    logger.info("IntelliCare Nexus shutting down")


app = FastAPI(
    title="IntelliCare Nexus API",
    description="Autonomous Clinical Decision and Access Platform — Multi-Agent Healthcare AI",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(patients_router, prefix=API_PREFIX)
app.include_router(prior_auth_router, prefix=API_PREFIX)
app.include_router(trials_router, prefix=API_PREFIX)
app.include_router(agents_router, prefix=API_PREFIX)
app.include_router(tools_router, prefix=API_PREFIX)

# WebSocket registered using FastAPI decorator to support dependencies like Query
@app.websocket("/ws/agents/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, token: str = Query(default="")):
    await websocket_agent_events(websocket, session_id, token)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "IntelliCare Nexus API",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/gemini")
async def gemini_health():
    """Check Gemini API connectivity — useful for pre-demo validation."""
    from app.services.gemini_service import check_gemini_health
    result = await check_gemini_health()
    return result


@app.get("/")
async def root():
    return {
        "message": "IntelliCare Nexus API",
        "docs": "/docs",
        "version": settings.APP_VERSION,
        "agents": 10,
        "mcp_tools": 12,
    }
