import { fetchAPI } from './api';

/**
 * Interface for voice data from the ElevenLabs API
 */
export interface VoiceDTO {
  voiceId: string;
  name: string;
  samples?: VoiceSampleDTO[];
  category?: string;
  fineTuning?: FineTuningDTO;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
  availableForTiers?: string[];
  settings?: VoiceSettingsDTO;
  sharing?: VoiceSharingDTO;
  highQualityBaseModelIds?: string[];
  verifiedLanguages?: VerifiedLanguageDTO[];
  safetyControl?: string;
  isOwner?: boolean;
  isLegacy?: boolean;
  isMixed?: boolean;
  createdAtUnix?: number;
}

/**
 * Interface for voice sample data
 */
export interface VoiceSampleDTO {
  sampleId?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  hash?: string;
  durationSecs?: number;
}

/**
 * Interface for voice fine-tuning information
 */
export interface FineTuningDTO {
  isAllowedToFineTune?: boolean;
  state?: Record<string, string>;
  verificationFailures?: string[];
  verificationAttemptsCount?: number;
  manualVerificationRequested?: boolean;
}

/**
 * Interface for voice settings
 */
export interface VoiceSettingsDTO {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
}

/**
 * Interface for voice sharing information
 */
export interface VoiceSharingDTO {
  status?: string;
  historyItemSampleId?: string;
  dateUnix?: number;
  whitelistedEmails?: string[];
  publicOwnerId?: string;
  originalVoiceId?: string;
  financialRewardsEnabled?: boolean;
  freeUsersAllowed?: boolean;
  liveModerationEnabled?: boolean;
  rate?: number;
  voiceMixingAllowed?: boolean;
  featured?: boolean;
  category?: string;
  readerAppEnabled?: boolean;
  likedByCount?: number;
  clonedByCount?: number;
}

/**
 * Interface for verified language information
 */
export interface VerifiedLanguageDTO {
  language: string;
  modelId: string;
  accent?: string;
  locale?: string;
  previewUrl?: string;
}

/**
 * Interface for the frontend voice data that matches the UI components
 */
export interface VoiceData {
  id: string;
  name: string;
  tags: string[];
  language: string;
  accent: string;
  gender: string;
  useCase: string;
  provider: string;
  previewUrl?: string;
  pricePerMinute?: string;
  category?: string; // Added to identify generated voices
  highQualityBaseModelIds?: string[]; // Available models for the voice
}

/**
 * Map ElevenLabs voice data to our application's format
 * @param voice ElevenLabs voice data
 * @returns VoiceData object
 */
function mapElevenLabsVoiceToVoiceData(voice: any): VoiceData {
  // Determine use case based on voice characteristics
  let useCase = 'Narrative';
  if (voice.category === 'professional') {
    useCase = 'Conversational';
  } else if (voice.labels?.accent === 'british') {
    useCase = 'Educational';
  } else if (voice.labels?.accent === 'australian') {
    useCase = 'Entertainment';
  } else if (voice.name.includes('Santa') || voice.name.includes('Glinda')) {
    useCase = 'Character';
  }
  
  // Create tags array from voice properties
  const tags = [];
  if (voice.labels?.gender) tags.push(voice.labels.gender);
  if (voice.labels?.accent) tags.push(voice.labels.accent);
  // Only add category to tags if it's not 'generated' or 'cloned'
  if (voice.category && voice.category !== 'generated' && voice.category !== 'cloned') {
    tags.push(voice.category);
  }
  
  // Extract properties with fallbacks
  const gender = voice.labels?.gender || 'neutral';
  const accent = voice.labels?.accent || 'neutral';
  
  // Determine language based on accent
  let language = 'english'; // Default to English
  if (accent === 'italian') language = 'italian';
  if (accent === 'swedish') language = 'swedish';
  
  // Determine if this is a generated voice (Jibu-generated)
  const isGenerated = voice.category === 'cloned' || voice.name.includes('Generated') || voice.name.includes('Jibu');
  
  return {
    id: voice.voiceId || voice.voice_id,
    name: voice.name,
    tags: tags.length > 0 ? tags : ['neutral', 'premade'],
    language: language,
    accent: accent,
    gender: gender,
    useCase: useCase,
    provider: 'ElevenLabs',
    previewUrl: voice.previewUrl || voice.preview_url,
    pricePerMinute: '$0.015',
    category: isGenerated ? 'generated' : voice.category || '',
    highQualityBaseModelIds: voice.high_quality_base_model_ids || []
  };
}

/**
 * Get all available voices
 * @returns Promise<VoiceData[]> List of available voices
 */
export async function getVoices(): Promise<VoiceData[]> {
  try {
    console.log('Fetching voices from API...');
    
    // Always try to fetch from the API first
    const response = await fetchAPI('/v1/voices');
    
    // If we get a valid response, use it
    if (response && Array.isArray(response) && response.length > 0) {
      console.log(`Successfully fetched ${response.length} voices from API`);
      return response.map(mapElevenLabsVoiceToVoiceData);
    } else {
      console.warn('Invalid or empty response from voices API, using mock data as fallback');
      return getMockVoices();
    }
  } catch (error) {
    console.error('Error fetching voices from API:', error);
    console.log('Falling back to mock data');
    // Fall back to mock data in case of error
    return getMockVoices();
  }
}

/**
 * Generate mock voices for development/testing
 */
function getMockVoices(): VoiceData[] {
  // Real ElevenLabs preview URLs for testing
  const previewUrls = [
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6285d9-9a93-4c7d-b0bf-14628f2e3e6c.mp3', // Rachel
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/82a79aabd08cab81224258ec8d05368b.mp3', // Domi
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/04365bce-98cc-4e99-9f10-56b60680cda9.mp3', // Bella
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/ODq5zmih8GrVes37Dizd/f9f2b4d0-d1d3-4a55-a814-c7d981a51be7.mp3', // Antoni
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/ae2b713f-5d31-4a91-8d95-3f93c9a0eb6f.mp3', // Elli
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/yoZ06aMxZJJ28mfd3POQ/b1c63a75-9b5b-48e8-9c1b-147f42e80fd8.mp3', // Josh
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/flq6f7yk4E4fJM5XTYuZ/5a1d5b72-2c5f-4dca-87a7-4f9a57c473aa.mp3', // Arnold
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/29vD33N1CtxCmqQRPOHJ/f9f2b4d0-d1d3-4a55-a814-c7d981a51be7.mp3', // Adam
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/D38z5RcWu1voky8WS1ja/b1c63a75-9b5b-48e8-9c1b-147f42e80fd8.mp3', // Sam
    'https://storage.googleapis.com/eleven-public-prod/premade/voices/jsCqWAovK2LkecY7zXl4/f9f2b4d0-d1d3-4a55-a814-c7d981a51be7.mp3', // Ethan
  ];

  // Voice names
  const voiceNames = [
    'Rachel', 'Domi', 'Bella', 'Antoni', 'Elli',
    'Josh', 'Arnold', 'Adam', 'Sam', 'Ethan'
  ];

  // Create mock voices with realistic data
  return Array.from({ length: 10 }, (_, i) => {
    const genders = ['male', 'female'];
    const accents = ['american', 'british', 'australian', 'indian', 'neutral'];
    const useCases = ['Conversational', 'Narrative', 'Educational', 'Entertainment'];
    
    const gender = i < 5 ? 'female' : 'male'; // First 5 are female, rest are male
    const accent = accents[i % accents.length];
    const useCase = useCases[i % useCases.length];
    
    return {
      id: `elevenlabs-${i + 1}`,
      name: voiceNames[i],
      tags: [gender, accent, useCase],
      language: 'english',
      accent,
      gender,
      useCase,
      provider: 'ElevenLabs',
      previewUrl: previewUrls[i],
      pricePerMinute: '$0.015'
    };
  });
}

// Keep track of the currently playing audio element
let currentAudio: HTMLAudioElement | null = null;

/**
 * Play a voice sample
 * @param previewUrl URL of the voice sample to play
 */
export function playVoiceSample(previewUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate the preview URL
    if (!previewUrl) {
      console.error('No preview URL provided');
      reject(new Error('No preview URL provided'));
      return;
    }
    
    // Stop any currently playing audio
    stopAllAudio();
    
    // Create a new audio element
    const audio = new Audio();
    
    // Set up event listeners before setting the source
    audio.addEventListener('ended', () => {
      currentAudio = null;
      resolve();
    });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      currentAudio = null;
      reject(new Error(`Failed to play audio: ${e.message || 'Unknown error'}`));
    });
    
    // Set the audio source
    audio.src = previewUrl;
    
    // Set the current audio to this new element
    currentAudio = audio;
    
    // Log the URL being played for debugging
    console.log('Playing audio from URL:', previewUrl);
    
    // Start playing
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      currentAudio = null;
      reject(error);
    });
  });
}

/**
 * Stop all currently playing audio
 */
export function stopAllAudio(): void {
  // Stop the tracked audio element if it exists
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  
  // Also find any other audio elements and pause them (as a fallback)
  document.querySelectorAll('audio').forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
}

/**
 * Get a specific voice by ID
 * @param voiceId ID of the voice to retrieve
 */
export async function getVoiceById(voiceId: string): Promise<VoiceData | null> {
  try {
    // Fetch all voices and find the one with the matching ID
    const voices = await getVoices();
    return voices.find(voice => voice.id === voiceId) || null;
  } catch (error) {
    console.error(`Failed to fetch voice with ID ${voiceId}:`, error);
    throw error;
  }
}
