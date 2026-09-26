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
                       session_id: str, room: str, phone_number_id: str | None = None,
                       direction: str | None = None, from_number: str | None = None,
                       to_number: str | None = None) -> dict:
    """POST /livekit/calls/acquire -> {acquired, active, limit, callId}.

    callId is None on a fail-open response (backend/DB unreachable) — this is
    expected graceful degradation, not an error: the call still connects, it
    just won't have a Call history row for that one instance.
    """
    url = f"{BACKEND_API_URL}/livekit/calls/acquire"
    payload = {
        "workspaceId": workspace_id,
        "connectionId": connection_id,
        "agentId": agent_id,
        "sessionId": session_id,
        "room": room,
        "phoneNumberId": phone_number_id,
        "direction": direction,
        "fromNumber": from_number,
        "toNumber": to_number,
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        logger.error("acquire_call failed: %s", e)
        # Fail open so a backend hiccup doesn't drop all calls.
        return {"acquired": True, "active": 0, "limit": 0, "callId": None, "error": str(e)}


async def mark_call_connected(workspace_id: str, connection_id: str) -> None:
    """POST /livekit/calls/mark-connected — call once the agent session
    actually starts (audio flowing), not just on room join."""
    url = f"{BACKEND_API_URL}/livekit/calls/mark-connected"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={"workspaceId": workspace_id, "connectionId": connection_id})
    except Exception as e:  # noqa: BLE001
        logger.debug("mark_call_connected failed: %s", e)


async def release_call(workspace_id: str, connection_id: str, status: str | None = None,
                       disconnect_reason: str | None = None) -> None:
    url = f"{BACKEND_API_URL}/livekit/calls/release"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={
                "workspaceId": workspace_id,
                "connectionId": connection_id,
                "status": status,
                "disconnectReason": disconnect_reason,
            })
    except Exception as e:  # noqa: BLE001
        logger.error("release_call failed: %s", e)


async def heartbeat_call(workspace_id: str, connection_id: str) -> None:
    url = f"{BACKEND_API_URL}/livekit/calls/heartbeat"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={"workspaceId": workspace_id, "connectionId": connection_id})
    except Exception as e:  # noqa: BLE001
        logger.debug("heartbeat_call failed: %s", e)
