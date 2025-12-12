'use client';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  ControlBar,
  PreJoin,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useState } from 'react';

export default function TestVoicePage() {
  const [token, setToken] = useState('');
  const [shouldConnect, setShouldConnect] = useState(false);

  async function handleJoin(values: { username: string }) {
    try {
        // Fetch token from backend directly (bypassing proxy for debugging)
        const response = await fetch(`http://localhost:4000/api/livekit/token?room=test-room&user=${values.username}`);
        const data = await response.json();
        setToken(data.token);
        setShouldConnect(true);
    } catch (e) {
        console.error("Failed to fetch token", e);
    }
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white" data-lk-theme="default">
       {!shouldConnect ? (
        <div className="p-4 bg-gray-800 rounded-lg">
            <h1 className="text-xl mb-4 text-center">Join Voice Test</h1>
            <PreJoin
                onSubmit={handleJoin}
                defaults={{
                    username: 'test-user',
                }}
            />
        </div>
       ) : (
        <LiveKitRoom
            video={false}
            audio={true}
            token={token}
            serverUrl="ws://localhost:7880"
            connect={true}
            onDisconnected={() => setShouldConnect(false)}
        >
            <div className="flex flex-col items-center gap-4 h-full justify-center">
            <h1 className="text-2xl">Jibu Voice Test (Connected)</h1>
            <div className="h-32 w-64 bg-black rounded flex items-center justify-center">
                <BarVisualizer />
            </div>
            <ControlBar />
            <RoomAudioRenderer />
            </div>
        </LiveKitRoom>
       )}
    </div>
  );
}