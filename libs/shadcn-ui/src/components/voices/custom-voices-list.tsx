"use client";

import React, { useState, useMemo } from 'react';
import { VoiceListItem } from './voice-list-item';
import { VoicesPagination } from './voices-pagination';
import { VoiceData } from './voices-list';

// Mock custom voices
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
  };
});

// Helper function to generate a price per minute based on voice ID
const getPriceByVoiceId = (id: string): string => {
  const numId = parseInt(id.replace('custom-', ''));
  if (numId % 5 === 0) return '$0.018';
  if (numId % 3 === 0) return '$0.012';
  if (numId % 2 === 0) return '$0.015';
  return '$0.010';
};

interface CustomVoicesListProps {
  onFilterClick?: () => void;
}

export const CustomVoicesList: React.FC<CustomVoicesListProps> = ({ onFilterClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  
  const itemsPerPage = 5;
  
  // Get all custom voices
  const allVoices = useMemo(() => {
    return mockCustomVoices;
  }, []);
  
  const totalPages = Math.ceil(allVoices.length / itemsPerPage);

  const currentVoices = allVoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePlayToggle = (voiceId: string) => {
    setPlayingVoiceId(prevId => (prevId === voiceId ? null : voiceId));
    // Here you would typically also interact with an audio player
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(prevId => (prevId === voiceId ? null : voiceId));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Reset selected voice when changing pages
    setSelectedVoice(null);
  };

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 w-full">
        {currentVoices.map(voice => (
          <VoiceListItem
            key={voice.id}
            name={voice.name}
            tags={voice.tags}
            provider={voice.provider}
            pricePerMinute={getPriceByVoiceId(voice.id)}
            isPlaying={playingVoiceId === voice.id}
            isSelected={selectedVoice === voice.id}
            onPlayToggle={() => handlePlayToggle(voice.id)}
            onSelect={() => handleVoiceSelect(voice.id)}
          />
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="mt-4">
          <VoicesPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default CustomVoicesList;
