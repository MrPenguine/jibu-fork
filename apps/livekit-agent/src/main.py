from livekit.agents import WorkerOptions, cli
from agent.factory import entrypoint
from config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            ws_url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET
        )
    )
