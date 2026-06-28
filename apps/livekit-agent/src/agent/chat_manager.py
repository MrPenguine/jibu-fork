import asyncio
import logging

from livekit import rtc
from livekit.agents import JobContext

logger = logging.getLogger("chat-manager")


class ChatManager:
    """Handles text-channel input over LiveKit data channels.

    Text and voice share ONE path: incoming text is fed to the same
    ``AgentSession`` (same system prompt, LLM and tools) used for voice, and the
    generated reply is published back over the data channel.
    """

    def __init__(self, ctx: JobContext, session, system_prompt: str):
        self.ctx = ctx
        self.session = session
        self.room = ctx.room
        self.system_prompt = system_prompt

        self.room.on("data_received", self._on_data)
        logger.info("ChatManager initialized for room: %s", self.room.name)

    def _on_data(self, data: rtc.DataPacket):
        payload = data.data if hasattr(data, "data") else data
        try:
            text = payload.decode("utf-8")
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to decode data message: %s", e)
            return

        identity = data.participant.identity if getattr(data, "participant", None) else "unknown"
        logger.info("Received text from %s: %s", identity, text)
        asyncio.create_task(self._process_text(text))

    async def _process_text(self, text: str):
        """Drive a single turn through the shared AgentSession and reply as text."""
        try:
            reply_text = ""
            # Preferred path: AgentSession drives LLM + tools identically to voice.
            handle = self.session.generate_reply(user_input=text)
            result = await handle if asyncio.iscoroutine(handle) else handle
            reply_text = getattr(result, "text_content", None) or getattr(result, "text", None) or ""

            if reply_text:
                await self.send_message(reply_text)
        except Exception as e:  # noqa: BLE001
            logger.error("Failed to process text message: %s", e)

    async def send_message(self, text: str):
        payload = text.encode("utf-8")
        await self.room.local_participant.publish_data(payload=payload, reliable=True)
        logger.info("Sent text: %s", text)
