import React, { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useLocalParticipant
} from '@livekit/components-react';
import { Track, ParticipantEvent } from 'livekit-client';
import { VoiceDetector } from './voice-detector';
import { cn } from '@libs/shadcn-ui/lib/utils';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Slider } from '@libs/shadcn-ui/components/ui/slider';

interface LiveKitRoomProps {
  token: string;
  serverUrl: string;
  className?: string;
}

/**
 * LiveKitRoom component that provides a complete LiveKit room experience
 * with video conference, audio renderer, control bar, and voice detection
 */
export function LiveKitRoomComponent({
  token,
  serverUrl,
  className,
}: LiveKitRoomProps) {
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    // Set connecting to false after a short delay to simulate connection process
    const timer = setTimeout(() => {
      setConnecting(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!token || !serverUrl) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-md bg-gray-50">
        <div className="text-center">
          <h3 className="text-lg font-medium">Missing Configuration</h3>
          <p className="text-sm text-gray-500 mt-2">
            LiveKit token and server URL are required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={!connecting}
        // Explicitly request microphone permissions and enable audio level monitoring
        options={{
          publishDefaults: {
            microphone: true,
            camera: false
          },
          adaptiveStream: true,
          dynacast: true,
          // Enable audio level monitoring with more frequent updates
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          // Set more frequent audio level updates
          audioLevelUpdateFrequency: 50
        }}
      >
        {/* Audio renderer for room audio */}
        <RoomAudioRenderer />
        
        <RoomContent />
      </LiveKitRoom>
    </div>
  );
}

/**
 * Room content component with video grid and controls
 */
function RoomContent() {
  // Get video tracks for the grid layout
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  
  return (
    <div className="flex flex-col space-y-4">
      {/* Voice detection controls */}
      <VoiceDetectionControls />
      
      {/* Video conference grid (can be hidden if not needed) */}
      <div className="h-64 border rounded-md overflow-hidden">
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
      </div>
      
      {/* Control bar for audio/video controls */}
      <ControlBar />
    </div>
  );
}

/**
 * Component for adjusting voice detection settings
 */
function VoiceDetectionControls() {
  const [threshold, setThreshold] = useState(0.05);
  const [debounceTime, setDebounceTime] = useState(300);
  const { localParticipant } = useLocalParticipant();
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Get local audio track to monitor levels
  const tracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  );
  
  // Create a stable reference to threshold for use in the effect
  const thresholdRef = React.useRef(threshold);
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    if (!localParticipant) return;
    
    // Set up a polling interval to check audio level with more frequent updates
    const audioLevelInterval = setInterval(() => {
      // Access the audioLevel property directly from the participant
      const level = localParticipant.audioLevel || 0;
      
      // Log audio level for debugging (can be removed later)
      if (level > 0.01) {
        console.log('VoiceDetectionControls audio level:', level);
      }
      
      setAudioLevel(level);
    }, 50); // Poll every 50ms for better responsiveness
    
    // Monitor speaking state changes
    const handleSpeakingChanged = (speaking: boolean) => {
      // If speaking, set a minimum audio level to ensure UI feedback
      if (speaking) {
        setAudioLevel(Math.max(thresholdRef.current + 0.01, (localParticipant as any).audioLevel || 0));
      }
    };
    localParticipant.on(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
    
    return () => {
      // Clean up when component unmounts
      clearInterval(audioLevelInterval);
      localParticipant.off(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
    };
  }, [localParticipant]); // Only depend on localParticipant to avoid dependency array issues
  
  return (
    <div className="p-4 border rounded-md mb-4">
      <h3 className="text-lg font-medium mb-2">Voice Detection Settings</h3>
      
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-2">
          <Label htmlFor="threshold">Voice Detection Threshold: {threshold.toFixed(2)}</Label>
          <Slider
            id="threshold"
            min={0}
            max={0.2}
            step={0.01}
            value={[threshold]}
            onValueChange={(values: number[]) => setThreshold(values[0])}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>0.2</span>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <Label htmlFor="debounce">Debounce Time: {debounceTime}ms</Label>
          <Slider
            id="debounce"
            min={100}
            max={1000}
            step={50}
            value={[debounceTime]}
            onValueChange={(values: number[]) => setDebounceTime(values[0])}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>100ms</span>
            <span>1000ms</span>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Current Audio Level: {(audioLevel * 100).toFixed(1)}%
          </label>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-100",
                audioLevel > threshold ? "bg-green-500" : "bg-blue-500"
              )}
              style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
            />
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">
            <strong>Tips:</strong> Lower threshold values make voice detection more sensitive.
            Higher debounce values reduce flickering but increase detection delay.
          </p>
        </div>
      </div>
      
      {/* Custom voice detector with the current settings */}
      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">Preview with current settings:</h4>
        {/* Pass the local participant to the VoiceDetector */}
        {localParticipant && (
          <VoiceDetector 
            threshold={threshold}
            debounceMs={debounceTime}
            className="mt-4"
            participant={localParticipant}
          />
        )}
      </div>
    </div>
  );
}

export default LiveKitRoomComponent;
