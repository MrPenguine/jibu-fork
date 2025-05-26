"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { VoiceListItem } from './voice-list-item';
import { VoicesPagination } from './voices-pagination';
import { VoiceFilters } from './voices-filter-modal';
import { getVoices, VoiceData, playVoiceSample, stopAllAudio } from '../../../../../apps/frontend/src/utils/voicesApi';

// VoiceData interface is now imported from voicesApi.ts

// Custom voices - this would ideally come from the backend as well
const mockCustomVoices: VoiceData[] = Array.from({ length: 5 }, (_, i) => {
  const genders = ['male', 'female'];
  const gender = genders[i % genders.length];
  
  return {
    id: `custom-${i + 1}`,
    name: `Custom Voice ${i + 1}`,
    tags: [`Custom`, `${gender}`],
    provider: 'Custom',
    language: 'english',
    accent: 'neutral',
    gender,
    useCase: 'Custom',
    pricePerMinute: '$0.010',
  };
});

interface VoicesListProps {
  activeTab?: string;
  selectedProvider?: string;
  onFilterClick?: () => void;
  filters?: VoiceFilters;
  onFilteredCountChange?: (count: number, hasActiveFilters: boolean) => void;
}

// These helper functions are no longer needed as we get provider and price from the API
// Keeping them commented out for reference
/*
const getProviderByVoiceId = (id: string): string => {
  const numId = parseInt(id, 10);
  if (numId % 6 === 0) return 'PlayHT';
  if (numId % 5 === 0) return 'ElevenLabs';
  if (numId % 4 === 0) return 'Azure';
  if (numId % 3 === 0) return 'Google';
  if (numId % 2 === 0) return 'OpenAI';
  return 'Custom';
};

const getPriceByVoiceId = (id: string): string => {
  const numId = parseInt(id, 10);
  if (numId % 7 === 0) return '$0.025';
  if (numId % 5 === 0) return '$0.018';
  if (numId % 3 === 0) return '$0.012';
  if (numId % 2 === 0) return '$0.015';
  return '$0.010';
};
*/

export const VoicesList: React.FC<VoicesListProps> = ({ 
  activeTab = 'library', 
  selectedProvider = 'All',
  onFilterClick,
  filters = { language: '', accent: '', gender: [], useCase: [] },
  onFilteredCountChange
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiVoices, setApiVoices] = useState<VoiceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceData[]>([]);
  
  const itemsPerPage = 5;
  
  // Fetch voices from the API when the component mounts
  useEffect(() => {
    const loadVoices = async () => {
      try {
        setIsLoading(true);
        setError(null); // Clear any previous errors
        console.log('Loading voices...');
        const fetchedVoices = await getVoices();
        console.log(`Loaded ${fetchedVoices.length} voices`);
        setVoices(fetchedVoices);
      } catch (error) {
        console.error('Failed to load voices:', error);
        setError('Failed to load voices. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadVoices();
  }, []);
  
  // Get the appropriate voices based on the active tab
  const allVoices = useMemo(() => {
    return activeTab === 'library' ? voices : mockCustomVoices;
  }, [activeTab, voices]);
  
  // Filter voices based on the selected provider and other filters
  const filteredVoices = useMemo(() => {
    let result = [...allVoices];
    
    // Filter by provider from the categories section
    if (selectedProvider !== 'All') {
      // Check if the selectedProvider is one of our provider options
      if (['Azure', 'ElevenLabs', 'Google', 'OpenAI'].includes(selectedProvider)) {
        // Filter by the provider property
        result = result.filter(voice => voice.provider === selectedProvider);
      } 
      // If it's a use case category
      else if (['Advertising', 'Conversational', 'Educational', 'Entertainment', 'Narrative', 'Character'].includes(selectedProvider)) {
        result = result.filter(voice => voice.useCase === selectedProvider);
      }
      // Otherwise use the provider property directly
      else {
        result = result.filter(voice => {
          // Just use the provider property from the voice data
          return voice.provider === selectedProvider;
        });
      }
    }
    
    // Apply additional filters from props
    if (filters.language) {
      result = result.filter(voice => voice.language === filters.language);
    }
    
    if (filters.accent) {
      result = result.filter(voice => voice.accent === filters.accent);
    }
    
    if (filters.gender.length > 0) {
      result = result.filter(voice => filters.gender.includes(voice.gender));
    }
    
    // Handle provider filtering from the side filter modal
    if (filters.useCase && filters.useCase.length > 0) {
      // Check if any of the useCase values are actually provider names
      const providerFilters = filters.useCase.filter(item => 
        ['Azure', 'ElevenLabs', 'Google', 'OpenAI'].includes(item)
      );
      
      if (providerFilters.length > 0) {
        // Filter by provider
        result = result.filter(voice => providerFilters.includes(voice.provider || ''));
      } else {
        // Filter by traditional use case
        result = result.filter(voice => filters.useCase.includes(voice.useCase));
      }
    }
    
    return result;
  }, [allVoices, selectedProvider, filters]);
  
  // Notify parent component of the filtered count and whether filters are active
  useEffect(() => {
    if (onFilteredCountChange) {
      // Check if any filters are active
      const hasActiveFilters = !!(  // Convert to boolean with double negation
        filters.language || 
        filters.accent || 
        filters.gender.length > 0 || 
        filters.useCase.length > 0 ||
        selectedProvider !== 'All'
      );
      
      // Pass both the count and whether filters are active
      onFilteredCountChange(filteredVoices.length, hasActiveFilters);
    }
  }, [filteredVoices.length, onFilteredCountChange, filters, selectedProvider]);

  const totalPages = Math.ceil(filteredVoices.length / itemsPerPage);

  const currentVoices = filteredVoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePlayToggle = (voiceId: string) => {
    // If this voice is already playing, stop it
    if (playingVoiceId === voiceId) {
      stopAllAudio();
      setPlayingVoiceId(null);
      return;
    }
    
    // Stop any currently playing audio
    stopAllAudio();
    
    // Find the voice to play
    const voiceToPlay = allVoices.find(v => v.id === voiceId);
    if (!voiceToPlay || !voiceToPlay.previewUrl) {
      console.error('No preview URL available for this voice');
      return;
    }
    
    // Play the voice sample
    setPlayingVoiceId(voiceId);
    playVoiceSample(voiceToPlay.previewUrl)
      .then(() => {
        // Auto-stop when finished
        setPlayingVoiceId(null);
      })
      .catch(err => {
        console.error('Error playing voice sample:', err);
        setPlayingVoiceId(null);
      });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setPlayingVoiceId(null); // Stop playback when changing page
  };
  
  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(prevId => prevId === voiceId ? null : voiceId);
  };
  
  const handleMenuOpen = (voiceId: string) => {
    console.log(`Opening menu for voice: ${voiceId}`);
    // Here you would implement the menu functionality
  };
  
  // We no longer need this function since filters are passed as props
  const handleApplyFilters = (newFilters: VoiceFilters) => {
    // No longer using local state for filters
    setCurrentPage(1); // Reset to first page when filters change
  };
  
  // Show empty state for Your Voices tab when there are no custom voices
  if (activeTab === 'yourVoices' && mockCustomVoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <span className="text-primary text-2xl">+</span>
        </div>
        <h3 className="text-lg font-medium mb-2">No custom voices yet</h3>
        <p className="text-gray-500 mb-6 text-center max-w-md">Create your first custom voice to get started</p>
        <button 
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          onClick={() => console.log('Start creating voice')}
        >
          Start Creating Voice
        </button>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-gray-500">Loading voices...</p>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="py-8 text-center text-red-500">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {currentVoices.length > 0 ? (
        <>
          {currentVoices.map(voice => {
            return (
              <VoiceListItem 
                key={voice.id} 
                name={voice.name} 
                tags={voice.tags} 
                isPlaying={playingVoiceId === voice.id}
                onPlayToggle={() => handlePlayToggle(voice.id)}
                provider={voice.provider}
                pricePerMinute={voice.pricePerMinute || '$0.015'}
                isSelected={selectedVoice === voice.id}
                onSelect={() => handleVoiceSelect(voice.id)}
                onMenuOpen={() => handleMenuOpen(voice.id)}
              />
            );
          })}
          {totalPages > 1 && (
            <VoicesPagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
          )}
        </>
      ) : (
        <div className="py-8 text-center text-gray-500">
          {activeTab === 'library' ? 'No voices found for the selected filter.' : 'No custom voices found.'}
        </div>
      )}
    </div>
  );
};

export default VoicesList;
