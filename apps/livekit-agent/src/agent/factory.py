import asyncio
import json
import logging
import uuid

from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.llm import function_tool
from livekit.agents.beta.tools.send_dtmf import send_dtmf_events
from livekit.plugins import google, silero, deepgram, elevenlabs, openai, azure, cartesia
from dotenv import load_dotenv

from config import DEFAULT_AGENT_ID, XAI_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY
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
        return google.LLM(model=model or "gemini-2.5-flash")
    if "openrouter" in provider:
        # OpenRouter is OpenAI-compatible; model ids stay vendor-namespaced.
        return openai.LLM(
            model=model or "google/gemini-2.5-flash",
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY,
        )
    if "ollama" in provider:
        # Ollama runs locally on port 11434 and is OpenAI-compatible.
        import os
        base_url = os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434/v1"
        return openai.LLM(
            model=model or "llama3",
            base_url=base_url,
            api_key="ollama",
        )
    if "grok" in provider or "xai" in provider or "x-ai" in provider:
        # xAI is OpenAI-compatible.
        return openai.LLM(model=model or "grok-3-latest", base_url="https://api.x.ai/v1", api_key=XAI_API_KEY)
    if "mistral" in provider:
        return openai.LLM(
            model=model or "mistral-large-latest",
            base_url="https://api.mistral.ai/v1",
            api_key=MISTRAL_API_KEY,
        )
    # Default fallback — Google Gemini 2.5 Flash (stable, no daily free-tier cap via API key)
    return google.LLM(model="gemini-2.5-flash")


def _build_stt(cfg: dict):
    """Map agent STT config to a LiveKit STT plugin."""
    voice = (cfg or {}).get("voice") or {}
    provider = (voice.get("sttProvider") or "deepgram").lower()

    if "google" in provider:
        return google.STT()
    if "azure" in provider:
        return azure.STT()
    if provider == "whisper" or "openai" in provider:
        # OpenAI's own hosted Whisper via the openai plugin
        return openai.STT(model="whisper-1")
    # Default: Deepgram — fast, reliable, no local infra required.
    return deepgram.STT()


def _build_tts(cfg: dict):
    """Map agent TTS config to a LiveKit TTS plugin."""
    voice = (cfg or {}).get("voice") or {}
    provider = (voice.get("ttsProvider") or "deepgram").lower()
    voice_id = voice.get("voiceId") or ""

    if "eleven" in provider or "elevenlabs" in provider:
        return elevenlabs.TTS(voice_id=voice_id) if voice_id else elevenlabs.TTS()
    if "google" in provider:
        # Google Cloud TTS — Chirp HD voices, 1M standard chars/month free
        return google.TTS(voice=voice_id) if voice_id else google.TTS()
    if "azure" in provider:
        # Azure Neural TTS — 500K chars/month free
        return azure.TTS(voice=voice_id) if voice_id else azure.TTS()
    if "cartesia" in provider:
        # Cartesia Sonic-2 — 1M chars/month free, best real-time quality
        return cartesia.TTS(voice=voice_id) if voice_id else cartesia.TTS()
    if provider == "openai":
        # OpenAI's own hosted TTS-1 / TTS-1-HD
        return openai.TTS(voice=voice_id or "alloy")
    # Default: Deepgram — fast, reliable, no local infra required.
    return deepgram.TTS()


def _build_tools(cfg: dict, workspace_id: str):
    """Turn the agent's tool definitions into LiveKit raw function tools.

    When the LLM calls a tool, we POST a single fast call to the backend
    (`/livekit/execute-tool`) — never the whole conversation.
    """
    # Agents can send DTMF to navigate a third-party IVR (already implemented
    # in the installed livekit-agents package — just wiring it in).
    tools = [send_dtmf_events]
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
    phone_number_id = meta.get("phone_number_id")
    connection_id = f"lk_{ctx.room.name}_{uuid.uuid4().hex[:8]}"

    if not agent_id:
        logger.error("No agent_id in room metadata and no DEFAULT_AGENT_ID; cannot start agent")
        return

    cfg = await backend_client.fetch_agent_config(agent_id)
    if not cfg:
        logger.error("Could not load agent config for %s", agent_id)
        return
    workspace_id = workspace_id or cfg.get("workspaceId")

    # Caller identity (Contact resolution): LiveKit sets sip.phoneNumber /
    # sip.trunkPhoneNumber as participant attributes on SIP-originated calls
    # — read before acquire_call below so the caller's number can be logged
    # onto the Call row from the moment it's created, not patched in later.
    # wait_for_participant() has to move ahead of the concurrency check for
    # this (was previously called after it, with no participant data used).
    participant = await ctx.wait_for_participant()
    logger.info("Participant joined: %s", participant.identity)
    # SIP calls carry the caller's number as a participant attribute; browser
    # test calls have none, but the tester's picked persona (if any) is
    # threaded through as room metadata's caller_phone instead (see
    # LivekitService.startVoiceSession) — either way, contact resolution in
    # CallConcurrencyService.tryAcquire only needs a non-empty from_number.
    from_number = (
        participant.attributes.get("sip.phoneNumber")
        if phone_number_id
        else meta.get("caller_phone")
    )

    # Enforce workspace concurrency limit before accepting the call, and
    # create this call's Call history row (phone_number_id present means
    # this room was pre-seeded by PhoneNumber.assignAgent() for a SIP-
    # originated call; absent means a browser-originated call).
    if workspace_id:
        result = await backend_client.acquire_call(
            workspace_id, connection_id, agent_id, session_id, ctx.room.name,
            phone_number_id=phone_number_id,
            direction="inbound" if phone_number_id else None,
            from_number=from_number,
        )
        if not result.get("acquired", False):
            logger.warning(
                "Rejecting call: concurrency limit reached (%s/%s)",
                result.get("active"), result.get("limit"),
            )
            await ctx.disconnect()
            return

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

    def _on_sip_dtmf_received(ev) -> None:
        # rtc.SipDTMF(code: int, digit: str, participant). Forward each digit
        # into the same AgentSession driving voice/text — no new dispatch
        # path, agent config branches on this via normal system-prompt/tool
        # logic (IVR menus, PIN auth), same as any other turn. One digit per
        # turn, not buffered: the LLM can track a running sequence ("received
        # 2, 4...") across turns itself, which avoids inventing a separate
        # buffering/timeout state machine here.
        logger.info("DTMF digit received: %s", ev.digit)
        asyncio.create_task(_handle_dtmf(ev.digit))

    async def _handle_dtmf(digit: str):
        try:
            handle = session.generate_reply(user_input=f"[DTMF digit pressed: {digit}]")
            if asyncio.iscoroutine(handle):
                await handle
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to process DTMF digit %s: %s", digit, e)

    ctx.room.on("sip_dtmf_received", _on_sip_dtmf_received)

    async def _on_shutdown():
        if workspace_id:
            # Exact rang-vs-dropped-vs-completed disconnect signal isn't
            # wired up yet (needs checking against the room-disconnect API,
            # tracked as a follow-up) — defaults to 'completed' server-side.
            await backend_client.release_call(workspace_id, connection_id)

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(agent_config, room=ctx.room)

    if workspace_id:
        await backend_client.mark_call_connected(workspace_id, connection_id)

    first_message = cfg.get("firstMessage")
    if first_message:
        await session.say(first_message, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
