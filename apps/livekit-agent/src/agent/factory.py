import logging
from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import google, silero, deepgram, elevenlabs
from dotenv import load_dotenv
import os

from .chat_manager import ChatManager
from .idle_monitor import IdleMonitor

load_dotenv()
logger = logging.getLogger("voice-agent")

async def entrypoint(ctx: JobContext):
    if not os.environ.get("DEEPGRAM_API_KEY"):
        raise ValueError("DEEPGRAM_API_KEY is missing from .env")

    # 1. Connect
    print(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # 2. Wait for participant
    participant = await ctx.wait_for_participant()
    print(f"Participant joined: {participant.identity}")
    
    # 3. Create Agent Configuration
    llm_instance = google.LLM(model="gemini-flash-latest")
    
    agent_config = Agent(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=llm_instance,
        tts=deepgram.TTS(),
        instructions="You are a helpful AI assistant created by Jibu AI. Your name is Jibu. You are concise, friendly, and professional.",
    )

    # 4. Create Session (Runtime)
    session = AgentSession()

    # 5. Initialize ChatManager & IdleMonitor
    chat_manager = ChatManager(ctx, agent=session, llm=llm_instance)
    idle_monitor = IdleMonitor(ctx)

    # 6. Start Session with Config and Room
    await session.start(agent_config, room=ctx.room)
    
    # 7. Greeting
    await session.say("Hello! I am Jibu. I'm connected via Voice and Text. How can I help you today?", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
