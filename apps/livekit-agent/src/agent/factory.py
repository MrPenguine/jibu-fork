import logging
from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import google, silero, deepgram, elevenlabs
from dotenv import load_dotenv
import os

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
    # STT: Deepgram (Fast, Reliable)
    # LLM: Gemini Pro (Smart)
    # TTS: ElevenLabs (High Quality)
    agent_config = Agent(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=google.LLM(model="gemini-flash-latest"),
        tts=deepgram.TTS(),
        instructions="You are a helpful AI assistant created by Jibu AI. Your name is Jibu. You are concise, friendly, and professional.",
    )

    # 4. Create Session (Runtime)
    session = AgentSession()
    
    # 5. Start Session with Config and Room
    await session.start(agent_config, room=ctx.room)
    
    # 6. Greeting
    await session.say("Hello! I am Jibu. I'm listening via Deepgram, thinking with Gemini, and speaking with Eleven Labs. How can I help?", allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
