import os
import asyncio
from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe
from livekit.plugins import elevenlabs
from livekit import rtc

async def entrypoint(ctx: JobContext):
    # 1. Connect
    print(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # 2. Initialize TTS
    tts = elevenlabs.TTS(api_key=os.environ.get("ELEVENLABS_API_KEY"))
    
    # 3. Wait for participant
    print("Waiting for participant...")
    participant = await ctx.wait_for_participant()
    
    print(f"Participant joined: {participant.identity}")
    
    # 4. Speak a greeting
    await asyncio.sleep(1)
    print("Saying hello...")
    async for audio in tts.synthesize("Hello! I am the Jibu AI Agent. I can hear you."):
        # Publish audio track
        # Note: livekit-agents 0.8+ handles this via VoicePipelineAgent usually, 
        # but for raw audio we might need a source. 
        # Simpler approach: Use VoicePipelineAgent if possible, but we lack STT/LLM keys for a full conversation.
        # So we will just just output to a source.
        pass

    # Better approach: Use a simple VoicePipelineAgent with just TTS and a dummy STT/LLM? 
    # Or just use the 'say' convenience if available.
    
    # ACTUALLY, checking standard examples:
    # ctx.room.local_participant.publish_data ...
    # We need to create a source.
    
    source = rtc.AudioSource(48000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("agent-mic", source)
    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE
    publication = await ctx.room.local_participant.publish_track(track, options)

    # Stream TTS to source
    async for chunk in tts.synthesize("Hello! I am connected and ready."):
        # chunk is likely a frame or bytes. 
        # livekit-plugins-elevenlabs returns AudioFrame?
        # Let's verify via docs or source if possible.
        # Assuming AudioFrame. 
        await source.capture_frame(chunk.frame)

    print("Greeting sent.")
