"use client";

import React from 'react';

interface VoiceListItemProps {
  name: string;
  tags: string[];
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  provider?: string;
  pricePerMinute?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onMenuOpen?: () => void;
}

// Define provider colors mapping
const providerColors: Record<string, string> = {
  'All': '#6B7280',
  'PlayHT': '#3B82F6',
  'ElevenLabs': '#8B5CF6',
  'Azure': '#0078D4',
  'Google': '#34A853',
  'OpenAI': '#10a37f',
  'Custom': '#9333ea',
  'Conversational': '#f59e0b',
  'Narrative': '#10b981',
  'Character': '#ef4444',
  'Educational': '#8b5cf6',
  'Advertising': '#ec4899',
  'Entertainment': '#f97316',
};

export const VoiceListItem: React.FC<VoiceListItemProps> = ({ 
  name, 
  tags, 
  isPlaying, 
  onPlayToggle, 
  provider = 'All', 
  pricePerMinute = '$0.015',
  isSelected = false,
  onSelect,
  onMenuOpen
}) => {
  // Using the primary color from CSS variables
  const primaryColor = 'var(--primary)';
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <div 
      className="flex items-center justify-between p-4 mb-4 rounded-xl transition-all duration-200" 
      style={{ 
        width: '100%', 
        margin: '0 0 1rem 0',
        backgroundColor: isSelected ? `rgba(${hexToRgb(primaryColor)}, 0.1)` : isHovered ? `rgba(${hexToRgb(primaryColor)}, 0.05)` : 'white',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer'
      }}
      onClick={() => onSelect && onSelect()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left section - Play button and voice info */}
      <div className="flex items-center">
        <button
          onClick={(e) => { e.stopPropagation(); if (onPlayToggle) onPlayToggle(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center mr-4"
          style={{ backgroundColor: primaryColor }}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          )}
        </button>
        <div>
          <h3 className="font-medium">{name}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((tag, index) => (
              <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Middle section - Price per minute */}
      <div className="text-center mx-4">
        <div className="text-sm font-medium text-gray-500">Price</div>
        <div className="font-bold" style={{ color: primaryColor }}>{pricePerMinute}/min</div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Provider badge - always show a provider or Custom */}
        <div 
          className="px-3 py-1 rounded-full text-white text-xs font-medium"
          style={{ backgroundColor: providerColors[provider] || providerColors['Custom'] }}
        >
          {provider !== 'All' ? provider : 'Custom'}
        </div>
        
        {/* Three-dot menu button */}
        <button 
          onClick={(e) => { e.stopPropagation(); if (onMenuOpen) onMenuOpen(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>
    </div>
  );
};

// Helper function to convert hex color to RGB format
const hexToRgb = (hex: string): string => {
  // If it's a CSS variable, return a default
  if (hex.startsWith('var(')) {
    return '100, 100, 255'; // Default fallback for CSS variables
  }
  
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
};

export default VoiceListItem;
