"use client";

import React from 'react';

interface CategoryCardProps {
  title: string;
  color?: string;
  isSelected?: boolean;
  onClick?: () => void;
  isCreateCard?: boolean;
  count?: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ title, color, isSelected, onClick, isCreateCard, count }) => {
  // Using primary color from CSS variables
  const primaryColor = 'var(--primary)';
  
  return (
    <div 
      onClick={onClick}
      style={{
        width: '150px', // Smaller width to fit more cards in a row
        height: '90px', // Smaller height
        backgroundColor: isCreateCard ? 'transparent' : color || '#333333',
        border: isCreateCard ? `2px dashed ${primaryColor}` : isSelected ? `2px solid ${primaryColor}` : 'none',
        borderRadius: '12px',
        display: 'flex',
        alignItems: isCreateCard ? 'center' : 'flex-end',
        justifyContent: 'center',
        padding: '12px',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: isSelected ? `0 8px 16px rgba(0,0,0,0.2), 0 0 0 2px ${primaryColor}` : isCreateCard ? 'none' : '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease-in-out',
        position: 'relative' // For positioning the tick emoji
      }}
      className={isSelected ? 'ring-2 ring-primary' : 'hover:opacity-90'}
    >
      {isSelected && !isCreateCard && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'rgba(255,255,255,0.3)',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span role="img" aria-label="Selected">✓</span>
        </div>
      )}
      {isCreateCard ? (
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <span className="text-primary text-2xl">+</span>
          </div>
          <span style={{ color: '#0284c7', fontSize: '14px' }}>{title}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <span style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '6px', fontSize: '14px'}}>{title}</span>
          {count !== undefined && (
            <span className="mt-2 text-xs bg-white/20 px-2 py-1 rounded-full">{count} voices</span>
          )}
        </div>
      )}
    </div>
  );
};

interface VoicesCategoriesProps {
  selectedProvider?: string;
  onProviderSelect?: (provider: string) => void;
  voiceCounts?: Record<string, number>;
}

const categoriesData = [
  { title: 'All', color: '#6B7280' /* Gray */ },
  { title: 'PlayHT', color: '#3B82F6' /* Blue */ },
  { title: 'ElevenLabs', color: '#8B5CF6' /* Purple */ },
  { title: 'Azure', color: '#0078D4' /* Microsoft Blue */ },
  { title: 'Google', color: '#34A853' /* Google Green */ },
  { title: 'OpenAI', color: '#10a37f' /* OpenAI Green */ },
];

export const VoicesCategories: React.FC<VoicesCategoriesProps> = ({ selectedProvider = 'All', onProviderSelect, voiceCounts = {} }) => {
  return (
    <div className="relative py-4 w-full">
      <div className="flex space-x-4 pb-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        {categoriesData.map(cat => (
          <div key={cat.title} className="snap-start flex-shrink-0">
            <CategoryCard 
              title={cat.title} 
              color={cat.color} 
              isSelected={selectedProvider === cat.title}
              onClick={() => onProviderSelect && onProviderSelect(cat.title)}
              count={voiceCounts[cat.title] || (cat.title === 'All' ? voiceCounts.total : 0)}
            />
          </div>
        ))}
        
        {/* Create Custom Voice card */}
        <div className="snap-start flex-shrink-0">
          <CategoryCard 
            title="Create Custom Voice" 
            isCreateCard={true}
            onClick={() => onProviderSelect && onProviderSelect('Create')}
          />
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full"></div>
    </div>
  );
};

export default VoicesCategories;
