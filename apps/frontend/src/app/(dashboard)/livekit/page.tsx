'use client';

import { useState, useEffect } from 'react';

// Define local RoomInfo type to match LiveKit's room structure
type RoomInfo = {
  sid: string;
  name: string;
  numParticipants?: number;
  emptyTimeout?: number;
  creationTime?: number;
  metadata?: string;
};
import { LiveKitRoomComponent } from '../../../../../../libs/shadcn-ui/src/components/livekit/livekit-room';
import { VoiceDetector } from '../../../../../../libs/shadcn-ui/src/components/livekit/voice-detector';
import { RealtimeTranscript } from '../../../../../../libs/shadcn-ui/src/components/livekit/realtime-transcript';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@libs/shadcn-ui/components/ui/tabs';
import { livekitApiClient } from '../../../utils/livekitApi';
import { Loader2, Mic, MicOff, PhoneCall, PhoneOff } from 'lucide-react';
import { useLocalParticipant } from '@livekit/components-react';

/**
 * StandaloneDetector component that uses the VoiceDetector with the local participant
 */
function StandaloneDetector() {
  const { localParticipant } = useLocalParticipant();
  
  if (!localParticipant) {
    return <div className="text-center p-2">Waiting for local participant...</div>;
  }
  
  return (
    <VoiceDetector 
      participant={localParticipant} 
      threshold={0.05} 
      debounceMs={300}
      className="p-4"
    />
  );
}

export default function LiveKitTestPage() {
  const [roomName, setRoomName] = useState('test-room');
  const [identity, setIdentity] = useState('');
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('connect');
  const [healthStatus, setHealthStatus] = useState<{ status: string; configured: boolean; serverUrl: string } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Generate a random identity on component mount if not set
  useEffect(() => {
    if (!identity) {
      setIdentity(`user-${Math.floor(Math.random() * 10000)}`);
    }
    
    // Load rooms on mount
    loadRooms();
  }, [identity]);
  
  // Load available rooms
  const loadRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const roomsList = await livekitApiClient.listRooms();
      setRooms(roomsList as RoomInfo[]);
    } catch (err: unknown) {
      console.error('Failed to load rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Check LiveKit server health
  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await livekitApiClient.checkHealth();
      setHealthStatus(health);
    } catch (err) {
      console.error('Failed to check LiveKit health:', err);
      setHealthStatus({ status: 'error', configured: false, serverUrl: '' });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Create a new LiveKit room
  const createRoom = async () => {
    setIsCreatingRoom(true);
    setError('');
    
    try {
      await livekitApiClient.createRoom({
        roomName,
        emptyOnCreate: true
      });
      
      setRoomCreated(true);
      await loadRooms(); // Refresh room list
    } catch (err: unknown) {
      console.error('Failed to create room:', err);
      setError(err instanceof Error ? err.message : 'Failed to create LiveKit room');
    } finally {
      setIsCreatingRoom(false);
    }
  };
  
  // Connect to LiveKit room
  const connectToRoom = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Create room if it doesn't exist
      if (!roomCreated && !rooms.find((r: RoomInfo) => r.name === roomName)) {
        try {
          await livekitApiClient.createRoom({
            roomName,
            emptyOnCreate: true
          });
        } catch (roomErr) {
          // Ignore error if room already exists
          console.log('Room may already exist:', roomErr);
        }
      }
      
      // Get token from API
      const response = await livekitApiClient.getToken({
        identity,
        roomName,
      });
      
      setToken(response.token);
      setServerUrl(response.url);
      setIsConnected(true);
      setActiveTab('room');
    } catch (err: unknown) {
      console.error('Failed to connect to LiveKit room:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to LiveKit room');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from LiveKit room
  const disconnect = () => {
    setToken('');
    setServerUrl('');
    setIsConnected(false);
    setActiveTab('connect');
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">LiveKit Voice Detection Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left sidebar - Connection status */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>
                Check LiveKit server status and connection details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Connection:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Room:</span>
                  <span className="font-mono text-sm">{roomName || 'N/A'}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Identity:</span>
                  <span className="font-mono text-sm">{identity || 'N/A'}</span>
                </div>
                
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={checkHealth}
                    disabled={isCheckingHealth}
                  >
                    {isCheckingHealth ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Check Server Health'
                    )}
                  </Button>
                </div>
                
                {healthStatus && (
                  <div className={`p-3 rounded-md ${healthStatus.configured ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-sm font-medium">
                      Status: {healthStatus.status}
                    </p>
                    <p className={`text-xs ${healthStatus.configured ? 'text-green-700' : 'text-red-700'}`}>
                      {healthStatus.configured ? 'Server is configured' : 'Server is not configured'}
                    </p>
                    {healthStatus.serverUrl && (
                      <p className="text-xs mt-1">Server URL: {healthStatus.serverUrl}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              {isConnected ? (
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={disconnect}
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={connectToRoom}
                  disabled={isConnecting || !roomName || !identity}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="mr-2 h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        
        {/* Main content - Tabs for connection and room */}
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connect">Connection Settings</TabsTrigger>
              <TabsTrigger value="room" disabled={!isConnected}>Voice Room</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connect">
              <Card>
                <CardHeader>
                  <CardTitle>LiveKit Connection Settings</CardTitle>
                  <CardDescription>
                    Configure your LiveKit room connection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="room-name">Room Name</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="room-name"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Enter room name"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={loadRooms}
                        disabled={isLoadingRooms}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Room list */}
                  {rooms.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <Label>Available Rooms</Label>
                      <div className="max-h-32 overflow-y-auto border rounded-md">
                        <ul className="divide-y">
                          {rooms.map((room: RoomInfo) => (
                            <li 
                              key={room.name}
                              className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                              onClick={() => setRoomName(room.name)}
                            >
                              <div>
                                <span className="font-medium">{room.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({room.numParticipants ?? 0} participants)</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${(room.numParticipants ?? 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {(room.numParticipants ?? 0) > 0 ? 'Active' : 'Empty'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* Create room button */}
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={createRoom}
                      disabled={isCreatingRoom || !roomName}
                    >
                      {isCreatingRoom ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Room...
                        </>
                      ) : (
                        'Create Room'
                      )}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="identity">Your Identity</Label>
                    <Input
                      id="identity"
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                      placeholder="Enter your identity"
                    />
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                      {error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="room">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Detection Test</CardTitle>
                  <CardDescription>
                    Test voice activity detection with LiveKit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isConnected && token && serverUrl ? (
                    <LiveKitRoomComponent
                      token={token}
                      serverUrl={serverUrl}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64">
                      <p className="text-gray-500">
                        Connect to a LiveKit room to test voice detection
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setActiveTab('connect')}
                      >
                        Go to Connection Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
                {isConnected && token && serverUrl && (
                  <div className="mt-4 mb-2 px-4">
                    <RealtimeTranscript />
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Standalone voice detector for testing without room connection */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Standalone Voice Detector</CardTitle>
          <CardDescription>
            This component shows voice detection status when connected to a room
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md mx-auto">
            {isConnected && token ? (
              <LiveKitRoomComponent
                token={token}
                serverUrl={serverUrl}
              >
                {/* This will be rendered inside the LiveKitRoom context */}
                <StandaloneDetector />
              </LiveKitRoomComponent>
            ) : (
              <div className="text-center p-4 border rounded-md bg-gray-50">
                <p className="text-gray-500 mb-2">Connect to a room first to use voice detection</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab('connect')}
                >
                  Go to Connection Settings
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}