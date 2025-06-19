import React, { useState, useEffect, useRef } from 'react';
import { LocalParticipant, Participant, ParticipantEvent } from 'livekit-client';
import { cn } from '@libs/shadcn-ui/lib/utils';

interface VoiceDetectorProps {
  participant: LocalParticipant | Participant;
  threshold?: number;
  debounceMs?: number;
  className?: string;
}

/**
 * VoiceDetector component that shows "Talking" or "Not Talking" status
 * based on the participant's audio level using WebAudio API and LiveKit events
 */
export function VoiceDetector({
  participant,
  threshold = 0.1,
  debounceMs = 300,
  className,
}: VoiceDetectorProps) {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isInRoom, setIsInRoom] = useState<boolean>(false);
  
  // Create stable refs for values used in effects
  const thresholdRef = useRef<number>(threshold);
  const debounceRef = useRef<number>(debounceMs);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebAudio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs when props change
  useEffect(() => {
    thresholdRef.current = threshold;
    debounceRef.current = debounceMs;
  }, [threshold, debounceMs]);

  // Check if we have a participant
  useEffect(() => {
    setIsInRoom(!!participant);
  }, [participant]);

  // Function to handle audio level changes
  const handleAudioLevelChange = (level: number) => {
    setAudioLevel(level);
    
    // If level is above threshold, set talking to true
    if (level > thresholdRef.current) {
      setIsTalking(true);
      
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set a new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        setIsTalking(false);
      }, debounceRef.current);
    }
  };
  
  // Function to set up WebAudio API for microphone analysis
  const setupAudioAnalysis = async (): Promise<boolean> => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      microphoneStreamRef.current = stream;
      
      // Create audio context and analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect microphone to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Create data array for analysis
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      console.log('WebAudio API setup complete');
      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  };
  
  // Function to analyze audio and update state
  const analyzeAudio = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    // Get audio data
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate average volume level (0-1)
    const average = Array.from(dataArrayRef.current)
      .reduce((sum: number, value: number) => sum + value, 0) / dataArrayRef.current.length;
    
    // Normalize to 0-1 range (byte data is 0-255)
    const normalizedLevel = average / 255;
    
    // Log if significant audio detected
    if (normalizedLevel > 0.05) {
      console.log('WebAudio level detected:', normalizedLevel.toFixed(3));
    }
    
    // Update audio level state
    handleAudioLevelChange(normalizedLevel);
  };
  
  useEffect(() => {
    if (!participant) return;
    
    // Function to handle speaking changes from LiveKit
    const onSpeakingChanged = (speaking: boolean) => {
      setIsTalking(speaking);
    };
    
    // Set up WebAudio API for direct microphone analysis
    const initAudio = async () => {
      const success = await setupAudioAnalysis();
      if (success) {
        // Start analyzing audio at regular intervals
        audioAnalysisIntervalRef.current = setInterval(analyzeAudio, 50);
      }
    };
    
    // Initialize audio analysis
    initAudio();
    
    // Also listen for speaking events from LiveKit as a fallback
    participant.on(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
    
    // Set up a polling interval to check participant's audioLevel as another fallback
    const livekitAudioLevelInterval = setInterval(() => {
      const level = participant.audioLevel || 0;
      if (level > 0.01) {
        console.log('LiveKit audio level:', level);
        handleAudioLevelChange(level);
      }
    }, 100);
    
    return () => {
      // Clean up all resources
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (audioAnalysisIntervalRef.current) {
        clearInterval(audioAnalysisIntervalRef.current);
      }
      
      clearInterval(livekitAudioLevelInterval);
      
      // Stop microphone stream
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      // Remove LiveKit event listener
      participant.off(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
    };
  }, [participant]); // Only depend on participant to avoid dependency array issues

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <div className="flex items-center space-x-2">
        <div className="text-sm font-medium">
          {isTalking ? 'Talking' : 'Not talking'}
        </div>
        <div
          className={cn(
            'h-2 w-16 rounded-full',
            'bg-gray-200 dark:bg-gray-700',
            'overflow-hidden'
          )}
        >
          <div
            className={cn(
              'h-full rounded-full',
              isTalking ? 'bg-green-500' : 'bg-gray-400'
            )}
            style={{ width: isTalking ? '100%' : '0%' }}
          />
        </div>
      </div>
      
      {/* Audio level meter */}
      <div className="w-full mt-2">
        <div className="text-xs text-gray-500 mb-1">Audio Level: {Math.round(audioLevel * 100)}%</div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-100",
              isTalking ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
          />
        </div>
      </div>
      
      {/* Threshold indicator */}
      {isInRoom ? (
        <>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-300"
              style={{ width: `${threshold * 100}%` }}
            />
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-500 italic">
          Connect to a LiveKit room to use voice detection
        </div>
      )}
    </div>
  );
}

export default VoiceDetector;
