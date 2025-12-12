import os
from dotenv import load_dotenv

load_dotenv()

LIVEKIT_URL = os.getenv('LIVEKIT_URL', 'wss://your-project.livekit.cloud')
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET')

# Basic settings
try:
    HTTP_PORT = int(os.getenv('PORT', 8000))
except ValueError:
    HTTP_PORT = 8000
    
HOST = os.getenv('HOST', '0.0.0.0')
