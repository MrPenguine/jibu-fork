import logging
import asyncio
from livekit import rtc
from livekit.agents import JobContext

logger = logging.getLogger("chat-manager")

class ChatManager:
    """
    Handles text chat messages over LiveKit Data Channels.
    Integrates with the Voice Agent to process text input through the same LLM logic.
    """
    def __init__(self, ctx: JobContext, agent, llm):
        self.ctx = ctx
        self.agent = agent
        self.room = ctx.room
        self.llm = llm
        self.room = ctx.room
        self._chat_ctx = None
        
        # Listen for incoming data packets
        self.room.on("data_received", self.on_data)
        logger.info(f"ChatManager initialized for room: {self.room.name}")

    def on_data(self, data: rtc.DataPacket):
        # ... (decoding logic remains the same)
        # We can copy the decoding part to avoid rewriting it all, but here I focus on the structure change.
        # Wait, replace_file_content needs exact match. 
        # I will target __init__ to add self._chat_ctx first.
        pass 

    # I'll split this into two edits for safety. 
    # Edit 1: __init__
    
    # Edit 2: _process_text usage.


    def on_data(self, data: rtc.DataPacket):
        """
        Callback when data is received from the room.
        We expect UTF-8 text.
        """
        # In LiveKit Python SDK < 0.12, data is bytes. In newer versions it might be different.
        # Check type just in case, but usually it's bytes.
        payload = data.data if hasattr(data, 'data') else data
        
        try:
            text = payload.decode("utf-8")
            participant = data.participant
            identity = participant.identity if participant else "unknown"
            
            logger.info(f"Received text from {identity}: {text}")
            
            # FUTURE: Send this text to the agent's LLM interruptibility logic
            # For now, we just print it. The VoicePipelineAgent doesn't natively expose a "inject_text" method 
            # that is distinct from STT transcription results in the v1.3.6 public API yet.
            # However, we can simulate a user prompt by manually triggering the agent's LLM.
            
            # TODO: Integrate with agent logic
            
            # Integrate with agent logic (LLM) - Text Response Only
            logger.info(f"Injecting text into agent: {text}")
            
            # Offload to async task
            asyncio.create_task(self._process_text(text))
            
        except Exception as e:
            logger.error(f"Failed to decode data message: {e}")

    async def _process_text(self, text: str):
        """
        Manually drives the LLM to generate a text-only response.
        """
        try:
            # 1. Add User Message to Context
            from livekit.agents.llm import ChatContext
            
            # Access context
            # Try to get shared context from agent, otherwise use local persistent context
            chat_ctx = getattr(self.agent, "chat_ctx", None)
            
            if not chat_ctx:
                 if self._chat_ctx is None:
                     logger.info("Creating new persistent ChatContext for text chat.")
                     # Initialize fresh context
                     chat_ctx = ChatContext()
                     self._chat_ctx = chat_ctx
                     
                     # Fetch instructions from the persistent Agent config if available
                     # self.agent is the AgentSession. 
                     # Doing inspection earlier showed 'agent_config' is passed to start(). 
                     # But AgentSession doesn't easily expose the config back. 
                     # However, we can just use the standard Jibu prompt here since we are in the Agent code.
                     # OR pass instructions to ChatManager __init__.
                     # For now, hardcode the Jibu prompt to match factory.py
                     sys_prompt = "You are a helpful AI assistant created by Jibu AI. Your name is Jibu. You are concise, friendly, and professional."
                     chat_ctx.add_message(role="system", content=sys_prompt)
                 
                 chat_ctx = self._chat_ctx

            # Add user message
            chat_ctx.add_message(role="user", content=text)
            
            # 2. Call LLM (Streaming)
            stream = self.llm.chat(chat_ctx=chat_ctx)
            
            # 3. Stream Response to Data Channel
            # ... (stream handling remains same)
            full_response = ""
            async for chunk in stream:
                 content = None
                 if hasattr(chunk, 'choices') and chunk.choices:
                     content = chunk.choices[0].delta.content
                 elif hasattr(chunk, 'delta') and chunk.delta:
                     content = chunk.delta.content
                 
                 if content:
                     full_response += content
            
            # Send the full text response
            if full_response:
                await self.send_message(full_response)
                # 4. Add Bot Message to Context
                chat_ctx.add_message(role="assistant", content=full_response)
                
        except Exception as e:
            logger.error(f"Failed to process text message: {e}")

    async def send_message(self, text: str):
        """
        Sends a text message back to the client via Data Channel.
        """
        payload = text.encode("utf-8")
        await self.room.local_participant.publish_data(
            payload=payload,
            reliable=True
        )
        logger.info(f"Sent text: {text}")
