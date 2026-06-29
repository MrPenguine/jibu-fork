import os
from dotenv import load_dotenv

load_dotenv()

# --- LiveKit ---
LIVEKIT_URL = os.getenv('LIVEKIT_URL', 'wss://your-project.livekit.cloud')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')

# --- Backend (single-brain config + tool execution) ---
# The voice worker fetches the agent config and executes tools through the
# NestJS backend so voice shares the exact same agent definition as chat.
BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:4000/api')

# Optional fallback when room metadata does not carry an agent id.
DEFAULT_AGENT_ID = os.getenv('DEFAULT_AGENT_ID')

# --- Provider keys (read from env; never hardcode) ---
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
XAI_API_KEY = os.getenv('XAI_API_KEY')
MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
DEEPGRAM_API_KEY = os.getenv('DEEPGRAM_API_KEY')
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY')

# --- Basic settings ---
try:
    HTTP_PORT = int(os.getenv('PORT', 8000))
except ValueError:
    HTTP_PORT = 8000

HOST = os.getenv('HOST', '0.0.0.0')

# Idle timeout for a voice session (seconds).
try:
    IDLE_TIMEOUT_SECONDS = int(os.getenv('IDLE_TIMEOUT_SECONDS', 300))
except ValueError:
    IDLE_TIMEOUT_SECONDS = 300
