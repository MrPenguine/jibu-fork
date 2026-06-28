"""Async client for the NestJS backend.

The voice worker uses these endpoints so that voice shares the exact same agent
definition and tool execution path as web chat / WhatsApp (the single brain).
"""
import logging
from typing import Any, Optional

import aiohttp

from config import BACKEND_API_URL

logger = logging.getLogger("backend-client")


async def fetch_agent_config(agent_id: str) -> Optional[dict]:
    """GET /livekit/agent-config?agentId=... -> agent config dict."""
    url = f"{BACKEND_API_URL}/livekit/agent-config"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"agentId": agent_id}) as resp:
                if resp.status != 200:
                    logger.error("agent-config returned %s for %s", resp.status, agent_id)
                    return None
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to fetch agent config: %s", e)
        return None


async def execute_tool(tool_id: str, arguments: dict, workspace_id: str) -> Any:
    """POST /livekit/execute-tool -> tool result."""
    url = f"{BACKEND_API_URL}/livekit/execute-tool"
    payload = {"toolId": tool_id, "arguments": arguments, "workspaceId": workspace_id}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        logger.error("Tool execution failed: %s", e)
        return {"status": "failed", "error": str(e)}


async def acquire_call(workspace_id: str, connection_id: str, agent_id: str,
                       session_id: str, room: str) -> dict:
    """POST /livekit/calls/acquire -> {acquired, active, limit}."""
    url = f"{BACKEND_API_URL}/livekit/calls/acquire"
    payload = {
        "workspaceId": workspace_id,
        "connectionId": connection_id,
        "agentId": agent_id,
        "sessionId": session_id,
        "room": room,
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        logger.error("acquire_call failed: %s", e)
        # Fail open so a backend hiccup doesn't drop all calls.
        return {"acquired": True, "active": 0, "limit": 0, "error": str(e)}


async def release_call(workspace_id: str, connection_id: str) -> None:
    url = f"{BACKEND_API_URL}/livekit/calls/release"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={"workspaceId": workspace_id, "connectionId": connection_id})
    except Exception as e:  # noqa: BLE001
        logger.error("release_call failed: %s", e)


async def heartbeat_call(workspace_id: str, connection_id: str) -> None:
    url = f"{BACKEND_API_URL}/livekit/calls/heartbeat"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={"workspaceId": workspace_id, "connectionId": connection_id})
    except Exception as e:  # noqa: BLE001
        logger.debug("heartbeat_call failed: %s", e)
