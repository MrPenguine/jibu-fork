To integrate the LiveKit agent into your Nx monorepo **without breaking your current architecture**, we will follow a **"Sidecar Strategy"**. We will build the new components in parallel to your existing ones.

This approach creates a new Python agent alongside your existing Node.js worker and adds new modules to your backend/frontend without touching the core logic yet.

### **Phase 1: Infrastructure Setup (The Server)**

Before touching the code, you need a running LiveKit server. You can use **LiveKit Cloud** (easiest) or **Docker** (local).

**Option A: Local Docker (Recommended for Dev)**
Create a `docker-compose.yml` in your root `infra/` folder (or create one):

```yaml
# infra/docker-compose.livekit.yaml
version: '3.9'
services:
  livekit:
    image: livekit/livekit-server:latest
    command: --dev
    ports:
      - '7880:7880'
      - '5060:5060'
      - '5061:5061'
      - '5062:5062/udp'
    environment:
      - LIVEKIT_KEYS=devkey:devsecret
```

Run it: `docker-compose -f infra/docker-compose.livekit.yaml up`

---

### **Phase 2: The Backend Bridge (NestJS)**

We will add a **new module** to your NestJS backend to handle LiveKit authentication. This does not modify your existing `AgentService` or `n8n` logic yet.

1.  **Install SDK:**

    ```bash
    npm install livekit-server-sdk
    ```

2.  **Create the Module:**
    Create a new folder `apps/backend/src/v1/livekit/`.

3.  **Create Service (`livekit.service.ts`):**

    ```typescript
    // apps/backend/src/v1/livekit/livekit.service.ts
    import { Injectable } from '@nestjs/common';
    import { AccessToken } from 'livekit-server-sdk';

    @Injectable()
    export class LiveKitService {
      private apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
      private apiSecret = process.env.LIVEKIT_API_SECRET || 'devsecret';

      async createToken(participantName: string, roomName: string) {
        const at = new AccessToken(this.apiKey, this.apiSecret, {
          identity: participantName,
        });

        at.addGrant({ roomJoin: true, room: roomName });

        return await at.toJwt();
      }
    }
    ```

4.  **Create Controller (`livekit.controller.ts`):**

    ```typescript
    // apps/backend/src/v1/livekit/livekit.controller.ts
    import { Controller, Get, Query } from '@nestjs/common';
    import { LiveKitService } from './livekit.service';

    @Controller('livekit')
    export class LiveKitController {
      constructor(private readonly livekitService: LiveKitService) {}

      @Get('token')
      async getToken(@Query('room') room: string, @Query('user') user: string) {
        return { token: await this.livekitService.createToken(user, room) };
      }
    }
    ```

5.  **Register Module:** Add `LiveKitModule` to your `app.module.ts` imports.

---

### **Phase 3: The "Glass Box" Agent (Python)**

We will create a **new application** folder for the Python agent. We will **NOT** touch `apps/worker` yet (keep your n8n worker running).

1.  **Create Folder:**

    ```bash
    mkdir -p apps/voice-agent
    ```

2.  **Setup Python Environment:**
    Inside `apps/voice-agent`:

    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install livekit-agents python-dotenv livekit-plugins-openai livekit-plugins-silero
    ```

3.  **Create the Agent Entrypoint (`main.py`):**
    This is a standalone "Hello World" agent to prove the architecture.

    ```python
    # apps/voice-agent/main.py
    import asyncio
    from dotenv import load_dotenv
    from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
    from livekit.agents.voice_pipeline_agent import VoicePipelineAgent
    from livekit.plugins import openai, silero

    load_dotenv()

    async def entrypoint(ctx: JobContext):
        # Connect to the room
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

        # Create the Voice Agent
        agent = VoicePipelineAgent(
            vad=silero.VAD.load(),
            stt=openai.STT(),
            llm=openai.LLM(),
            tts=openai.TTS(),
        )

        # Start the conversation
        agent.start(ctx.room)
        await agent.say("Hello, I am the new Jibu Voice Agent. How can I help?")

    if __name__ == "__main__":
        # Point this to your local or cloud LiveKit server
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
    ```

4.  **Env File:** Create `apps/voice-agent/.env`:

    ```env
    LIVEKIT_URL=ws://localhost:7880
    LIVEKIT_API_KEY=devkey
    LIVEKIT_API_SECRET=devsecret
    OPENAI_API_KEY=sk-...
    ```

---

### **Phase 4: Frontend Test Page**

Add a hidden page to your frontend to test the connection without altering your main dashboard.

1.  **Install SDK:**

    ```bash
    npm install livekit-client @livekit/components-react @livekit/components-styles
    ```

2.  **Create Test Page:**
    Create `apps/frontend/src/app/test-voice/page.tsx` (assuming Next.js App Router):

    ```tsx
    'use client';
    import {
      LiveKitRoom,
      RoomAudioRenderer,
      BarVisualizer,
      ControlBar,
    } from '@livekit/components-react';
    import '@livekit/components-styles';
    import { useState, useEffect } from 'react';

    export default function TestVoicePage() {
      const [token, setToken] = useState('');

      useEffect(() => {
        // Fetch token from your NEW backend endpoint
        fetch('/api/livekit/token?room=test-room&user=test-user')
          .then((res) => res.json())
          .then((data) => setToken(data.token));
      }, []);

      if (!token) return <div>Loading...</div>;

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
          <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl="ws://localhost:7880"
            connect={true}
            data-lk-theme="default"
          >
            <div className="flex flex-col items-center gap-4">
              <h1 className="text-2xl">Jibu Voice Test</h1>
              <BarVisualizer />
              <ControlBar />
              <RoomAudioRenderer />
            </div>
          </LiveKitRoom>
        </div>
      );
    }
    ```

---

### **Phase 5: Launch & Verify**

You can now run everything in parallel without breaking your n8n setup.

1.  **Start Infrastructure:** `docker-compose up` (LiveKit).
2.  **Start Backend:** `nx serve backend` (NestJS).
3.  **Start Agent:** `python apps/voice-agent/main.py dev` (Python).
4.  **Start Frontend:** `nx serve frontend`.
5.  **Test:** Go to `http://localhost:4200/test-voice`.

**Result:**

- You will hear "Hello, I am the new Jibu Voice Agent."
- **Success:** You have successfully established the "Glass Box" pipeline (Frontend -\> LiveKit -\> Python).
- **Zero Regression:** Your existing `apps/worker` (n8n) and Dashboard are completely untouched.

Once this is working, you can proceed to migrate the actual logic from n8n to Python.

[LiveKit Python Agent Tutorial](https://www.youtube.com/watch?v=rYJb-YIeS1M)
This video demonstrates the initial setup of a LiveKit Python agent, which mirrors the "Phase 3" steps above.

http://googleusercontent.com/youtube_content/0
