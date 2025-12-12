# Jibu LiveKit Agent (Python)

This service is the "Universal Voice Gateway" for Jibu Console. It connects to the LiveKit Cloud infrastructure as a **Worker**, handling real-time audio (STT/TTS) and logic execution.

## 🚀 Installation

Ensure you have **Python 3.9+** installed.

```bash
# 1. Navigate to the directory
cd apps/livekit-agent

# 2. Create a virtual environment (Recommended)
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
```

### Environment Configuration
Copy `.env.example` to `.env` and fill in your LiveKit credentials:

```bash
cp .env.example .env
```

| Variable | Description |
| :--- | :--- |
| `LIVEKIT_URL` | WebSocket URL (e.g., `wss://project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | Server API Key |
| `LIVEKIT_API_SECRET` | Server API Secret |

---

## ▶️ Running the Agent

You can run the agent in **Dev Mode** (Hot Reload) or **Production Mode**.

### Via Python (Direct)
The simplest way to start the worker.
```bash
python src/main.py start
```
*   Add `--dev` for hot-reloading when files change (requires `watchfiles`):
    ```bash
    python src/main.py dev
    ```

### Via NX (Monorepo)
If you are in the root of the repo:
```bash
nx serve livekit-agent
```

---

## 📊 Understanding Logs & Metrics

When the agent runs, you will see JSON-formatted logs. Here is what they mean:

### 1. Connection Status
*   **`"message": "starting worker"`**: The process has started and is attempting to open a WebSocket connection to LiveKit.
*   **`"message": "registered worker"`**: ✅ **Success!** The agent is connected to the LiveKit Server and is officially "Online". It is now waiting for users to join a room.
*   **`"message": "shutting down worker"`**: The process was stopped (e.g., Ctrl+C) or lost connection.

### 2. Job Events
*   **`"message": "job started"`**: A user joined a room (or a SIP call started), and LiveKit assigned the call to this agent instance.
*   **`"agent_connected_to_room"`**: The Python code successfully joined the WebRTC room as a participant.

### 3. Latency Metrics (To be implemented)
In later phases, we will log:
*   **`ttft` (Time to First Token)**: How long between user silence and the first word of the agent's reply.
*   **`vad_latency`**: How fast we detected speech end.

---

## 🛠️ Project Structure

*   **`src/main.py`**: The entry point. Configures the Worker connection and CLI.
*   **`src/agent/factory.py`**: The "Brain". Contains the `entrypoint()` function that runs for *every* new call.
*   **`src/config.py`**: Loads environment variables.
