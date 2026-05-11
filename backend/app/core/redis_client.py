"""
Redis client for real-time agent state and pub/sub messaging.
"""
import json
import redis.asyncio as aioredis
from typing import Any, Optional
from app.core.config import settings


_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def publish_agent_event(session_id: str, event: dict):
    """Publish agent event to Redis pub/sub channel."""
    client = await get_redis()
    channel = f"agents:{session_id}"
    await client.publish(channel, json.dumps(event))


async def set_agent_state(session_id: str, state: dict, ttl: int = 3600):
    """Store agent workflow state in Redis."""
    client = await get_redis()
    key = f"agent_state:{session_id}"
    await client.setex(key, ttl, json.dumps(state))


async def get_agent_state(session_id: str) -> Optional[dict]:
    """Retrieve agent workflow state from Redis."""
    client = await get_redis()
    key = f"agent_state:{session_id}"
    data = await client.get(key)
    return json.loads(data) if data else None


async def delete_agent_state(session_id: str):
    """Remove agent workflow state from Redis."""
    client = await get_redis()
    key = f"agent_state:{session_id}"
    await client.delete(key)
