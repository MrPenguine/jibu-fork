import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind, Room, RemoteParticipant } from 'livekit-client';
import { Card, CardContent } from '@libs/shadcn-ui/components/ui/card';

interface RealtimeTranscriptProps {
  className?: string;
}

export function RealtimeTranscript({ className }: RealtimeTranscriptProps) {
  // Check if we're in a LiveKit room context
  let isInRoomContext = true;
  let room: Room | undefined;
  
  try {
    room = useRoomContext();
  } catch (e) {
    isInRoomContext = false;
  }
  
  const [transcript, setTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Listen for data messages from the LiveKit Agent
  useEffect(() => {
    if (!isInRoomContext || !room) return;
    
    // Function to handle data received from the LiveKit Agent
    const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant, kind?: DataPacket_Kind) => {
      try {
        // Convert the binary data to a string
        const dataString = new TextDecoder().decode(payload);
        const data = JSON.parse(dataString);
        
        console.log('Received data message:', data);
        
        // Handle different message types
        if (data.type === 'transcript' || data.type === 'transcription') {
          setTranscript(data.transcript || data.text || data.content || '');
          setIsTranscribing(true);
        } else if (data.type === 'error') {
          setError(data.message || data.error || 'Unknown error');
        } else if (data.type === 'transcription_started' || data.type === 'start') {
          setIsTranscribing(true);
          setError(null);
        } else if (data.type === 'transcription_ended' || data.type === 'end' || data.type === 'final') {
          setIsTranscribing(false);
          const finalText = data.transcript || data.text || data.content || '';
          if (finalText) {
            setTranscript(prev => prev ? `${prev}\n${finalText}` : finalText);
          }
        }
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    };
    
    // Subscribe to data messages
    room.on(RoomEvent.DataReceived, handleDataReceived);
    
    // Log that we're ready to receive transcriptions
    console.log('RealtimeTranscript component ready to receive transcriptions');
    
    // Cleanup function
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      console.log('RealtimeTranscript component unmounted');
    };
  }, [isInRoomContext, room]);
  
  // If not in a LiveKit room context, show a message
  if (!isInRoomContext) {
    return (
      <Card className={`${className || ''} w-full`}>
        <CardContent className="p-4">
          <div className="p-2 bg-yellow-50 text-yellow-700 text-sm rounded">
            This component must be used within a LiveKit room context.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`${className || ''} w-full`}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${isTranscribing ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium">
                {isTranscribing ? 'Transcribing...' : 'Transcription inactive'}
              </span>
            </div>
          </div>
          
          {error && (
            <div className="p-2 bg-red-50 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          
          <div className="min-h-[100px] max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded border text-sm">
            {transcript ? (
              <p>{transcript}</p>
            ) : (
              <p className="text-gray-400 italic">
                {isTranscribing ? 'Waiting for speech...' : 'No transcript available'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
