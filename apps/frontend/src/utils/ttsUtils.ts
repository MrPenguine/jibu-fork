import { API_BASE_URL, fetchAPI } from './api';
import { createClient } from './supabase/client';
import { getActiveOrgId } from './fileApi';

// Audio player for TTS
let audioPlayer: HTMLAudioElement | null = null;
let isPlaying = false;

interface TtsVoiceSettings {
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
}

/**
 * Get authorization headers with token and organization ID
 */
async function getAuthHeaders() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const orgId = getActiveOrgId();
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Accept': 'audio/mpeg',
    ...(orgId ? { 'X-Organization-ID': orgId } : {})
  };
}

/**
 * Convert text to speech and play the audio
 * @param text The text to convert to speech
 * @param voiceSettings Voice settings including voice ID and parameters
 * @param useStreaming Whether to use streaming TTS (default: true)
 * @returns Promise that resolves when audio starts playing
 */
export async function playTextToSpeech(
  text: string,
  voiceSettings: TtsVoiceSettings,
  useStreaming: boolean = true
): Promise<void> {
  try {
    // Stop any currently playing audio
    stopTextToSpeech();
    
    if (!text || !voiceSettings.voiceId) {
      console.warn('Missing text or voice ID for TTS');
      return;
    }
    
    // Create a new audio player if needed
    if (!audioPlayer) {
      audioPlayer = new Audio();
    }
    
    // Set up the request body
    const requestBody = {
      text,
      voiceId: voiceSettings.voiceId,
      modelId: voiceSettings.modelId || 'eleven_multilingual_v2',
      stability: voiceSettings.stability || 0.5,
      similarityBoost: voiceSettings.similarityBoost || 0.75,
      style: voiceSettings.style || 0,
      speakerBoost: voiceSettings.speakerBoost || true
    };
    
    // Determine the endpoint based on whether we're using streaming
    const endpoint = useStreaming 
      ? `${API_BASE_URL}/v1/voices/text-to-speech/stream` 
      : `${API_BASE_URL}/v1/voices/text-to-speech`;
    
    // Set up event listeners before setting the source
    audioPlayer.onplay = () => {
      isPlaying = true;
      console.log('TTS audio started playing');
    };
    
    audioPlayer.onended = () => {
      isPlaying = false;
      console.log('TTS audio finished playing');
    };
    
    audioPlayer.onerror = (event) => {
      // Get detailed error information
      const error = event as ErrorEvent;
      console.error('Error playing TTS audio:', {
        message: error.message || 'Unknown error',
        code: audioPlayer?.error?.code,
        details: audioPlayer?.error?.message
      });
      isPlaying = false;
    };
    
    // Get authentication headers
    const headers = await getAuthHeaders();
    
    // Use fetch to get the audio data with authentication
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Create a blob URL from the response
    const blob = await response.blob();
    
    // Verify blob content type
    if (!blob.type.includes('audio/')) {
      console.warn(`Unexpected content type: ${blob.type}, size: ${blob.size} bytes`);
      
      // Try to handle non-audio responses (might be JSON error)
      if (blob.size < 1000) { // Small enough to likely be an error message
        const text = await blob.text();
        throw new Error(`TTS API returned non-audio content: ${text}`);
      }
    }
    
    const url = URL.createObjectURL(blob);
    
    // Set the audio source and play
    audioPlayer.src = url;
    
    try {
      await audioPlayer.play();
      isPlaying = true;
    } catch (playError) {
      console.error('Error playing audio:', playError);
      throw playError;
    }
  } catch (error) {
    console.error('Error playing text to speech:', error);
    isPlaying = false;
    
    // Check if this is an authentication error and provide a more helpful message
    if (error instanceof Error && error.message && error.message.includes('401 Unauthorized')) {
      throw new Error('Authentication failed for TTS service. Please try logging out and back in.');
    }
    
    throw error; // Re-throw to allow caller to handle the error
  }
}

/**
 * Stop any currently playing TTS audio
 */
export function stopTextToSpeech(): void {
  if (audioPlayer && isPlaying) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    console.log('TTS audio stopped');
  }
}

/**
 * Check if TTS audio is currently playing
 * @returns Boolean indicating if audio is playing
 */
export function isTtsPlaying(): boolean {
  return isPlaying;
}
