import json
import logging
import uuid

from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.llm import function_tool
from livekit.plugins import google, silero, deepgram, elevenlabs
from dotenv import load_dotenv

from config import DEFAULT_AGENT_ID
from . import backend_client
from .chat_manager import ChatManager
from .idle_monitor import IdleMonitor

load_dotenv()
logger = logging.getLogger("voice-agent")


def _parse_metadata(ctx: JobContext) -> dict:
    """Read agent identity from room/job metadata.

    Expected keys: agent_id, session_id, workspace_id.
    """
    candidates = []
    try:
        if ctx.room and ctx.room.metadata:
            candidates.append(ctx.room.metadata)
    except Exception:  # noqa: BLE001
        pass
    try:
        if getattr(ctx, "job", None) and ctx.job.metadata:
            candidates.append(ctx.job.metadata)
    except Exception:  # noqa: BLE001
        pass

    for raw in candidates:
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and data:
                return data
        except (json.JSONDecodeError, TypeError):
            continue
    return {}


def _build_llm(cfg: dict):
    """Map agent provider/model to a LiveKit LLM plugin."""
    llm_cfg = (cfg or {}).get("llm") or {}
    provider = (llm_cfg.get("provider") or "").lower()
    model = llm_cfg.get("model") or ""

    if "gemini" in provider or "google" in provider:
        return google.LLM(model=model or "gemini-flash-latest")
    if "grok" in provider or "xai" in provider or "x-ai" in provider:
        # xAI is OpenAI-compatible.
        from livekit.plugins import openai
        return openai.LLM(model=model or "grok-3-latest", base_url="https://api.x.ai/v1")
    if "mistral" in provider:
        from livekit.plugins import openai
        return openai.LLM(model=model or "mistral-large-latest", base_url="https://api.mistral.ai/v1")
    # Default
    return google.LLM(model="gemini-flash-latest")


def _build_stt(cfg: dict):
    voice = (cfg or {}).get("voice") or {}
    provider = (voice.get("sttProvider") or "").lower()
    if "deepgram" in provider or not provider:
        return deepgram.STT()
    return deepgram.STT()


def _build_tts(cfg: dict):
    voice = (cfg or {}).get("voice") or {}
    provider = (voice.get("ttsProvider") or "").lower()
    voice_id = voice.get("voiceId")
    if "eleven" in provider:
        return elevenlabs.TTS(voice_id=voice_id) if voice_id else elevenlabs.TTS()
    return deepgram.TTS()


def _build_tools(cfg: dict, workspace_id: str):
    """Turn the agent's tool definitions into LiveKit raw function tools.

    When the LLM calls a tool, we POST a single fast call to the backend
    (`/livekit/execute-tool`) — never the whole conversation.
    """
    tools = []
    for defn in (cfg or {}).get("tools", []) or []:
        tool_id = defn.get("toolId")
        name = defn.get("name")
        if not tool_id or not name:
            continue
        schema = {
            "name": name,
            "description": defn.get("description") or "",
            "parameters": defn.get("parameters") or {"type": "object", "properties": {}},
        }

        def _make(tid):
            async def _impl(raw_arguments: dict):
                return await backend_client.execute_tool(tid, raw_arguments or {}, workspace_id)
            return _impl

        try:
            tools.append(function_tool(_make(tool_id), raw_schema=schema))
        except Exception as e:  # noqa: BLE001
            logger.error("Could not register tool %s: %s", name, e)
    return tools


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    meta = _parse_metadata(ctx)
    agent_id = meta.get("agent_id") or DEFAULT_AGENT_ID
    session_id = meta.get("session_id") or ctx.room.name
    workspace_id = meta.get("workspace_id")
    connection_id = f"lk_{ctx.room.name}_{uuid.uuid4().hex[:8]}"

    if not agent_id:
        logger.error("No agent_id in room metadata and no DEFAULT_AGENT_ID; cannot start agent")
        return

    cfg = await backend_client.fetch_agent_config(agent_id)
    if not cfg:
        logger.error("Could not load agent config for %s", agent_id)
        return
    workspace_id = workspace_id or cfg.get("workspaceId")

    # Enforce workspace concurrency limit before accepting the call.
    if workspace_id:
        result = await backend_client.acquire_call(
            workspace_id, connection_id, agent_id, session_id, ctx.room.name
        )
        if not result.get("acquired", False):
            logger.warning(
                "Rejecting call: concurrency limit reached (%s/%s)",
                result.get("active"), result.get("limit"),
            )
            await ctx.disconnect()
            return

    participant = await ctx.wait_for_participant()
    logger.info("Participant joined: %s", participant.identity)

    system_prompt = cfg.get("systemPrompt") or "You are a helpful assistant."
    tools = _build_tools(cfg, workspace_id or "")

    agent_config = Agent(
        vad=silero.VAD.load(),
        stt=_build_stt(cfg),
        llm=_build_llm(cfg),
        tts=_build_tts(cfg),
        instructions=system_prompt,
        tools=tools,
    )

    session = AgentSession()

    # Shared per-turn path for text-channel input.
    chat_manager = ChatManager(ctx, session=session, system_prompt=system_prompt)
    idle_monitor = IdleMonitor(ctx)

    async def _on_shutdown():
        if workspace_id:
            await backend_client.release_call(workspace_id, connection_id)

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(agent_config, room=ctx.room)

    first_message = cfg.get("firstMessage")
    if first_message:
        await session.say(first_message, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
