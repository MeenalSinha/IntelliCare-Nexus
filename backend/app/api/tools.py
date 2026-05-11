"""
MCP Tools API - exposes the tool registry to agents and the frontend.
Agents can discover, describe, and invoke tools through this API.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_user_id
from app.tools.registry import tool_registry
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/tools", tags=["mcp-tools"])


class ToolInvokeRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any] = {}


@router.get("/")
async def list_tools(_user_id: str = Depends(get_current_user_id)):
    """List all available MCP tools with descriptions and schemas."""
    return {
        "tools": tool_registry.list_tools(),
        "total": len(tool_registry.list_tools()),
    }


@router.post("/invoke")
async def invoke_tool(
    request: ToolInvokeRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """
    Invoke any registered MCP tool by name.
    This endpoint lets agents and the frontend call tools directly.
    """
    result = await tool_registry.invoke(request.tool_name, **request.parameters)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {
        "tool": result.tool_name,
        "success": result.success,
        "data": result.data,
        "latency_ms": result.latency_ms,
        "timestamp": result.timestamp,
    }


@router.get("/{tool_name}")
async def get_tool_detail(
    tool_name: str,
    _user_id: str = Depends(get_current_user_id),
):
    """Get metadata for a specific tool."""
    tools = {t["name"]: t for t in tool_registry.list_tools()}
    if tool_name not in tools:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
    return tools[tool_name]
