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
// import { Video, Mic, Share, LogOut } from 'lucide-react'; // Unused

import { ChatWidget } from '../../../components/chat-widget';

export default function TestVoicePage() {
  const [token, setToken] = useState('');
  const [shouldConnect, setShouldConnect] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);

  async function handleJoin(values: { username: string; audioEnabled: boolean }) {
    try {
        // Fetch token from backend
        // Note: Ideally use a NEXT_PUBLIC_ env var for the API URL in production
        const response = await fetch(`http://localhost:4000/api/livekit/token?room=test-room&user=${values.username}`);
        const data = await response.json();
        setToken(data.token);
        setMicEnabled(values.audioEnabled);
        setShouldConnect(true);
    } catch (e) {
        console.error("Failed to fetch token", e);
    }
  }

  return (
    <div className="h-screen w-full bg-[#0d1117] text-white overflow-hidden font-sans" data-lk-theme="default">
       {!shouldConnect ? (
        <div className="flex h-full items-center justify-center">
            <div className="p-8 bg-[#1a1f2e] border border-gray-700/50 rounded-2xl shadow-2xl max-w-md w-full">
                <h1 className="text-2xl font-bold mb-6 text-center text-white">Join Jibu Voice</h1>
                <PreJoin
                    onSubmit={handleJoin}
                    defaults={{
                        username: 'test-user',
                        audioEnabled: false,
                    }}
                    className="!bg-transparent [&_.lk-button]:bg-blue-600 [&_.lk-button]:!text-white [&_.lk-input]:bg-gray-800 [&_.lk-input]:border-gray-700"
                />
            </div>
        </div>
       ) : (
        <LiveKitRoom
            video={false}
            audio={micEnabled}
            token={token}
            serverUrl="ws://localhost:7880"
            connect={true}
            onDisconnected={() => setShouldConnect(false)}
            className="flex h-full w-full p-6 gap-6"
        >
            {/* Left Panel: Visualizer & Controls */}
            <div className="flex-1 flex flex-col bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-gray-800">
                {/* Main Visualizer Area */}
                <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">
                    
                    {/* Pulsing Glow / Gradient Background Effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
                    
                    {/* Icon / Branding */}
                    <div className="bg-gray-800/50 p-6 rounded-3xl backdrop-blur-sm border border-white/5 shadow-2xl">
                         <div className="h-32 w-64 flex items-center justify-center">
                            <BarVisualizer 
                                state="connected"
                                // trackRef defaults to main audio if omitted
                                className="h-full w-full"
                                options={{ color: '#60a5fa', thickness: 8, gap: 4 }}
                            />
                        </div>
                    </div>
                    
                    <h2 className="text-gray-400 font-medium tracking-wide text-lg z-10">Jibu Voice + Chat</h2>
                </div>

                {/* Bottom Controls */}
                <div className="p-6 flex justify-center pb-8 bg-gradient-to-t from-black/80 to-transparent">
                    {/* We customize the ControlBar via CSS or just use standard one. 
                        The standard one is robust. We can style it with the data-lk-theme.
                    */}
                    <div className="bg-gray-900/80 backdrop-blur rounded-full px-6 py-3 border border-gray-700/50 shadow-xl">
                        <ControlBar 
                            variation="minimal" 
                            controls={{ microphone: true, camera: true, screenShare: true, leave: true }}
                        />
                    </div>
                </div>
                
                <RoomAudioRenderer />
            </div>

            {/* Right Panel: Chat */}
            <div className="w-[400px] h-full flex-shrink-0">
                <ChatWidget />
            </div>
        </LiveKitRoom>
       )}
    </div>
  );
}