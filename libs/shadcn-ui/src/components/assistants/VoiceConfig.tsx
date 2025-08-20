"use client"

import React, { useState, useEffect, useRef } from "react"
import { Check, ChevronsUpDown, Info } from "lucide-react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Slider } from "@libs/shadcn-ui/components/ui/slider"
import { Switch } from "@libs/shadcn-ui/components/ui/switch"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { cn } from "@libs/shadcn-ui/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@libs/shadcn-ui/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@libs/shadcn-ui/components/ui/popover"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@libs/shadcn-ui/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@libs/shadcn-ui/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
// Import axios for API calls
import axios from 'axios'

// Define VoiceProvider type - currently only ElevenLabs is supported
type VoiceProvider = 'elevenlabs' | 'azure';

// Import the getVoices and playVoiceSample functions from voicesApi
import { getVoices, playVoiceSample, stopAllAudio } from "../../../../../apps/frontend/src/utils/voicesApi";

// Function to get available voices from the API
async function getAvailableVoices() {
  try {
    console.log('Fetching voices from API...');
    
    // Fetch voices using the getVoices function from voicesApi
    // This will get all voices including non-English ones
    const fetchedVoices = await getVoices();
    console.log(`Successfully fetched ${fetchedVoices.length} voices`);
    
    return fetchedVoices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
}

// Function to test voice synthesis
async function testVoiceSynthesis({ provider, voiceId, text }: { provider: VoiceProvider, voiceId: string, text: string }) {
  try {
    console.log(`Testing voice synthesis with provider: ${provider}, voiceId: ${voiceId}`);
    
    // For now, we're just returning a success message
    // In a real implementation, this would make an API call to synthesize speech
    return { success: true, message: 'Voice test successful' };
  } catch (error) {
    console.error('Error testing voice synthesis:', error);
    throw error;
  }
}

// Define interface for ElevenLabs voice DTO
interface ElevenLabsVoiceDto {
  id: string;
  name: string;
  gender: string;
  language?: string;
  accent?: string;
  pricePerMinute?: string;
  highQualityBaseModelIds?: string[];
  previewUrl?: string;
  tags?: string[];
}

// Voice provider options - only ElevenLabs is supported
const VOICE_PROVIDERS = [
  { id: 'elevenlabs', name: 'Eleven Labs' },
  { id: 'azure', name: 'Azure' }
];

// Default voice settings
const DEFAULT_SETTINGS = {
  similarity: 0.75,
  stability: 0.75,
  model: "eleven_multilingual_v2",
  speakerBoost: false,
  autoMode: false
};

// Available voice models
const DEFAULT_MODELS = [
  { value: "eleven_monolingual_v1", label: "Monolingual v1" },
  { value: "eleven_multilingual_v1", label: "Multilingual v1" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_turbo_v2", label: "Turbo v2" },
];

// Define props for the VoiceConfig component
interface VoiceConfigProps {
  voiceProvider: VoiceProvider;
  voiceId: string;
  useCustomVoiceId: boolean;
  voiceSettings?: any;
  welcomeMessage?: string;
  assistantId?: string;
  onVoiceProviderChange: (value: VoiceProvider) => void;
  onVoiceIdChange: (value: string) => void;
  onUseCustomVoiceIdChange: (value: boolean) => void;
  onVoiceSettingsChange?: (settings: any) => void;
  onWelcomeMessageChange?: (value: string) => void;
}

export function VoiceConfig({
  voiceProvider = 'elevenlabs',
  voiceId = '',
  useCustomVoiceId = false,
  voiceSettings = null,
  welcomeMessage = '',
  assistantId,
  onVoiceProviderChange,
  onVoiceIdChange,
  onUseCustomVoiceIdChange,
  onVoiceSettingsChange,
  onWelcomeMessageChange
}: VoiceConfigProps) {
  // State for UI
  const [openProviderDropdown, setOpenProviderDropdown] = useState(false);
  const [openVoiceDropdown, setOpenVoiceDropdown] = useState(false);
  const [openModelDropdown, setOpenModelDropdown] = useState(false);
  const [openSettingsCollapsible, setOpenSettingsCollapsible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for voice data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoiceDto[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<ElevenLabsVoiceDto | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  
  // State for voice settings - initialize with defaults
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  
  // State for available models
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  
  // State for test voice functionality
  const [testLoading, setTestLoading] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Flag to prevent infinite loops
  const initializedRef = useRef(false);
  const updatingParentRef = useRef(false);
  
  // Filter voices based on search query
  const filteredVoices = searchQuery 
    ? voices.filter(voice => voice.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : voices;
  
  // Load voices on component mount - this needs to happen first
  useEffect(() => {
    const loadVoices = async () => {
      if (voices.length > 0) return; // Only load once
      
      setLoading(true);
      setError(null);
      
      try {
        const fetchedVoices = await getAvailableVoices();
        console.log(`[VoiceConfig] Loaded ${fetchedVoices.length} voices`);
        setVoices(fetchedVoices);
      } catch (err) {
        console.error('[VoiceConfig] Error loading voices:', err);
        setError('Failed to load voices');
      } finally {
        setLoading(false);
      }
    };
    
    loadVoices();
  }, []); // Empty dependency array to only run once on mount
  
  // Initialize settings from props - runs after voices are loaded
  useEffect(() => {
    // Don't run initialization if we've already done it or if we don't have voices loaded yet
    if (initializedRef.current || voices.length === 0) return;
    
    if (!voiceSettings) {
      console.log('[VoiceConfig] No voice settings provided, using defaults');
      initializedRef.current = true;
      return;
    }
    
    console.log('[VoiceConfig] Initializing from props with loaded voices:', voiceSettings);
    
    // Check if we have voice settings from the database
    if (typeof voiceSettings === 'object') {
      // Check if this is the new format with provider, voiceId, model, etc.
      if ('provider' in voiceSettings && 'voiceId' in voiceSettings) {
        // Set voice provider (always elevenlabs for now)
        // Handle both '11labs' and 'elevenlabs' provider names for compatibility
        if ((voiceSettings.provider === '11labs' || voiceSettings.provider === 'elevenlabs') && voiceProvider !== 'elevenlabs') {
          console.log(`[VoiceConfig] Setting provider to elevenlabs (from ${voiceSettings.provider})`);
          onVoiceProviderChange('elevenlabs');
        }
        
        // Set voice ID
        if (voiceSettings.voiceId && voiceSettings.voiceId !== voiceId) {
          console.log(`[VoiceConfig] Setting voice ID to ${voiceSettings.voiceId}`);
          onVoiceIdChange(voiceSettings.voiceId);
          
          // Try to find the voice in the loaded voices
          const voice = voices.find(v => v.id === voiceSettings.voiceId);
          if (voice) {
            console.log(`[VoiceConfig] Found matching voice: ${voice.name}`);
            setSelectedVoice(voice);
          } else {
            console.log(`[VoiceConfig] Voice ID ${voiceSettings.voiceId} not found in available voices, enabling custom voice ID mode`);
            onUseCustomVoiceIdChange(true);
          }
        }
        
        // Set model and other settings
        setSettings({
          similarity: voiceSettings.similarityBoost || DEFAULT_SETTINGS.similarity,
          stability: voiceSettings.stability || DEFAULT_SETTINGS.stability,
          model: voiceSettings.model || DEFAULT_SETTINGS.model,
          speakerBoost: voiceSettings.speakerBoost || DEFAULT_SETTINGS.speakerBoost,
          autoMode: voiceSettings.autoMode || DEFAULT_SETTINGS.autoMode
        });
        
        console.log('[VoiceConfig] Settings initialized:', {
          similarity: voiceSettings.similarityBoost || DEFAULT_SETTINGS.similarity,
          stability: voiceSettings.stability || DEFAULT_SETTINGS.stability,
          model: voiceSettings.model || DEFAULT_SETTINGS.model,
          speakerBoost: voiceSettings.speakerBoost || DEFAULT_SETTINGS.speakerBoost,
          autoMode: voiceSettings.autoMode || DEFAULT_SETTINGS.autoMode
        });
      }
    }
    
    initializedRef.current = true;
  }, [voiceSettings, voiceProvider, voiceId, onVoiceProviderChange, onVoiceIdChange, onUseCustomVoiceIdChange, useCustomVoiceId, voices]);
  
  // Handle settings change
  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Only update parent if we're not in the middle of an update
      if (!updatingParentRef.current && initializedRef.current && onVoiceSettingsChange) {
        updatingParentRef.current = true;
        setTimeout(() => {
          const voice = voices.find(v => v.id === voiceId);
          
          // Always use '11labs' as the provider name when sending to backend
          // This ensures consistency with the backend's expected format
          onVoiceSettingsChange({
            voiceId: voiceId,
            provider: voiceProvider === 'elevenlabs' ? '11labs' : voiceProvider,
            similarityBoost: newSettings.similarity,
            stability: newSettings.stability,
            model: newSettings.model,
            speakerBoost: newSettings.speakerBoost,
            autoMode: newSettings.autoMode,
            name: voice?.name || ""
          });
          
          console.log('[VoiceConfig] Sending updated settings to parent:', {
            voiceId,
            provider: "11labs",
            model: newSettings.model,
            similarityBoost: newSettings.similarity,
            stability: newSettings.stability
          });
          
          updatingParentRef.current = false;
        }, 0);
      }
      
      return newSettings;
    });
  };
  
  // Update selected voice when voiceId changes or voices are loaded
  useEffect(() => {
    // If we have voices and a voice ID but no selected voice, try to find the voice
    if (voices.length > 0 && voiceId && !selectedVoice) {
      const voice = voices.find(v => v.id === voiceId);
      if (voice) {
        console.log(`[VoiceConfig] Found voice for ID ${voiceId}: ${voice.name}`);
        setSelectedVoice(voice);
      } else if (!useCustomVoiceId) {
        // If the voice ID isn't found in the available voices and we're not using custom voice ID,
        // we should enable custom voice ID mode
        console.log(`[VoiceConfig] Voice ID ${voiceId} not found in available voices, enabling custom voice ID mode`);
        onUseCustomVoiceIdChange(true);
      }
    }
  }, [voices, voiceId, selectedVoice, onUseCustomVoiceIdChange, useCustomVoiceId]);
  
  // Update available models when selected voice changes
  useEffect(() => {
    if (selectedVoice) {
      // Update available models based on the selected voice
      if (selectedVoice.highQualityBaseModelIds && selectedVoice.highQualityBaseModelIds.length > 0) {
        const modelOptions = selectedVoice.highQualityBaseModelIds.map(modelId => {
          const formattedName = modelId
            .replace('eleven_', '')
            .replace('_', ' ')
            .replace(/v(\d+)$/, 'v$1')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          return {
            value: modelId,
            label: formattedName
          };
        });
        
        setAvailableModels(modelOptions);
      } else {
        setAvailableModels(DEFAULT_MODELS);
      }
    }
  }, [selectedVoice]);
  
  // Handle playing voice preview
  const handlePlayPreview = (e: React.MouseEvent, voiceId: string, previewUrl?: string) => {
    e.stopPropagation(); // Prevent dropdown item click
    
    if (!previewUrl) {
      console.warn('No preview URL available for this voice');
      return;
    }
    
    if (playingVoiceId === voiceId) {
      // If this voice is already playing, stop it
      stopAllAudio();
      setPlayingVoiceId(null);
    } else {
      // Otherwise play this voice
      playVoiceSample(previewUrl)
        .then(() => {
          // Audio finished playing
          setPlayingVoiceId(null);
        })
        .catch(error => {
          console.error('Error playing voice sample:', error);
          setPlayingVoiceId(null);
        });
      
      // Set as currently playing
      setPlayingVoiceId(voiceId);
    }
  };
  
  // Handle voice change
  const handleVoiceChange = (value: string) => {
    console.log(`[VoiceConfig] Voice changed to: ${value}`);
    
    // Update the voice ID
    onVoiceIdChange(value);
    
    // Find the selected voice
    const voice = voices.find(v => v.id === value);
    if (voice) {
      console.log(`[VoiceConfig] Found voice: ${voice.name}`);
      setSelectedVoice(voice);
      
      // Update parent component with new voice settings
      if (onVoiceSettingsChange) {
        // Create updated settings object
        const updatedSettings = {
          voiceId: value,
          provider: voiceProvider === 'elevenlabs' ? '11labs' : voiceProvider,
          similarityBoost: settings.similarity,
          stability: settings.stability,
          model: settings.model,
          speakerBoost: settings.speakerBoost,
          autoMode: settings.autoMode,
          name: voice.name || ""
        };
        
        console.log('[VoiceConfig] Updating parent with new voice settings:', updatedSettings);
        onVoiceSettingsChange(updatedSettings);
      }
    } else {
      console.log(`[VoiceConfig] Voice with ID ${value} not found in available voices`);
    }
  };
  
  // Handle welcome message change
  const handleWelcomeMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onWelcomeMessageChange) {
      onWelcomeMessageChange(e.target.value);
    }
  };
  
  // Test voice functionality
  const handleTestVoice = async () => {
    if (!voiceId) return;
    
    setTestLoading(true);
    setTestAudioUrl(null);
    
    try {
      // If the selected voice has a preview URL, use that
      if (selectedVoice && selectedVoice.previewUrl) {
        console.log(`Using preview URL for voice ${selectedVoice.name}: ${selectedVoice.previewUrl}`);
        setTestAudioUrl(selectedVoice.previewUrl);
        return;
      }
      
      // Otherwise, generate audio using the API
      const text = welcomeMessage || "Hello, I'm your AI assistant. How can I help you today?";
      
      // Call the API to test voice synthesis
      const result = await testVoiceSynthesis({
        provider: voiceProvider,
        voiceId: voiceId,
        text
      });
      
      if (typeof result === 'string') {
        setTestAudioUrl(result);
      } else if (result && result.success) {
        // Handle the success case
        console.log('Voice test successful');
      }
    } catch (err) {
      console.error('Error testing voice:', err);
      setError('Failed to test voice');
    } finally {
      setTestLoading(false);
    }
  };
  
  // Play audio when test audio URL is set
  useEffect(() => {
    if (testAudioUrl && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    }
  }, [testAudioUrl]);
  
  return (
    <div className="w-full bg-white rounded-lg p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Content Area - 2/3 width */}
        <div className="w-full lg:w-2/3 space-y-6">
          {/* Provider Selection */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Provider</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {VOICE_PROVIDERS.find(provider => provider.id === voiceProvider)?.name || 'Select Provider'}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                {VOICE_PROVIDERS.map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => onVoiceProviderChange(provider.id as VoiceProvider)}
                    className="py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{provider.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Voice Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase">Voice</label>
              <div className="flex items-center space-x-2">
                <Label htmlFor="custom-voice-id" className="text-xs">
                  Add Voice ID Manually
                </Label>
                <Switch
                  id="custom-voice-id"
                  checked={useCustomVoiceId}
                  onCheckedChange={onUseCustomVoiceIdChange}
                />
              </div>
            </div>
            
            {useCustomVoiceId ? (
              <Input
                id="custom-voice-id"
                value={voiceId}
                onChange={(e) => onVoiceIdChange(e.target.value)}
                placeholder="Enter voice ID"
                className="w-full bg-white rounded-full border"
              />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                    {selectedVoice ? selectedVoice.name : 'Select Voice'}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                      <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0 max-h-[300px] overflow-y-auto">
                  <div className="p-2">
                    <div className="relative">
                      <Input
                        placeholder="Search voices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white rounded-md border pl-8"
                      />
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        <path
                          d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                  </div>
                  
                  {loading ? (
                    <DropdownMenuItem disabled>Loading voices...</DropdownMenuItem>
                  ) : filteredVoices.length === 0 ? (
                    <DropdownMenuItem disabled>No voices available</DropdownMenuItem>
                  ) : (
                    filteredVoices.map((voice) => (
                      <DropdownMenuItem 
                        key={voice.id} 
                        onClick={() => handleVoiceChange(voice.id)}
                        className="flex flex-col items-start w-full py-3"
                      >
                        <div className="w-full flex items-center justify-between">
                          <div className="font-medium">{voice.name}</div>
                          {voice.previewUrl && (
                            <button
                              onClick={(e) => handlePlayPreview(e, voice.id, voice.previewUrl)}
                              className="w-8 h-8 rounded-full flex items-center justify-center mr-1"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              {playingVoiceId === voice.id ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="6" y="4" width="4" height="16"></rect>
                                  <rect x="14" y="4" width="4" height="16"></rect>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 w-full flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            {voice.gender}
                          </span>
                          {voice.accent && voice.accent !== 'neutral' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                              {voice.accent}
                            </span>
                          )}
                          {voice.language && voice.language !== 'english' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                              {voice.language}
                            </span>
                          )}
                          {voice.pricePerMinute && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                              {voice.pricePerMinute}
                            </span>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {/* Test Voice Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleTestVoice}
              disabled={!voiceId || testLoading}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2 text-xs"
            >
              {testLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 3L19 12L5 21V3Z" fill="currentColor" />
                </svg>
              )}
              <span>Test Voice</span>
            </Button>
            
            {testAudioUrl && (
              <audio ref={audioRef} src={testAudioUrl} controls className="hidden" />
            )}
          </div>
        </div>
        
        {/* Right Settings Panel - 1/3 width */}
        <div className="w-full lg:w-1/3 space-y-6">
          {/* Voice Model Selection */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Voice Model</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {availableModels.find(m => m.value === settings.model)?.label || 'Select Model'}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                {availableModels.map((model) => (
                  <DropdownMenuItem
                    key={model.value}
                    onClick={() => handleSettingChange('model', model.value)}
                    className="py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{model.label}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Stability Slider */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Stability</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Slider
                className="w-full"
                min={0}
                max={1}
                step={0.01}
                value={[settings.stability]}
                onValueChange={([value]) => handleSettingChange('stability', value)}
              />
              <span className="ml-2">{Math.round(settings.stability * 100)}%</span>
            </div>
          </div>
          
          {/* Similarity Slider */}
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Similarity</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Slider
                className="w-full"
                min={0}
                max={1}
                step={0.01}
                value={[settings.similarity]}
                onValueChange={([value]) => handleSettingChange('similarity', value)}
              />
              <span className="ml-2">{Math.round(settings.similarity * 100)}%</span>
            </div>
          </div>
          
          {/* Advanced Settings */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-xs font-bold uppercase">Speaker Boost</label>
              <Switch
                id="speaker-boost"
                checked={settings.speakerBoost}
                onCheckedChange={(value) => handleSettingChange('speakerBoost', value)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase">Auto Mode</label>
              <Switch
                id="auto-mode"
                checked={settings.autoMode}
                onCheckedChange={(value) => handleSettingChange('autoMode', value)}
              />
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm mt-4">{error}</div>
      )}
    </div>
  )
}

// Simple Select component
function Select({ id, value, onValueChange, options }: { 
  id: string, 
  value: string, 
  onValueChange: (value: string) => void,
  options: { value: string, label: string }[]
}) {
  const [open, setOpen] = useState(false)
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {options.find(option => option.value === value)?.label || 'Select...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
