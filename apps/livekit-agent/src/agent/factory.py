from livekit.agents import JobContext, WorkerOptions, cli, AutoSubscribe

async def entrypoint(ctx: JobContext):
    # 1. Connect
    print(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # 2. Wait for user
    print("Waiting for participant...")
    participant = await ctx.wait_for_participant()
    
    # 3. Log (Proof of Life)
    print(f"Agent successfully connected to room: {ctx.room.name}")
    print(f"Participant joined: {participant.identity}")
    print("Ready to process audio...")
