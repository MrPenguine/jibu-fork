"use client";

import React from 'react';

interface VoicesTabsProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const VoicesTabs: React.FC<VoicesTabsProps> = ({ activeTab = 'library', onTabChange }) => {

  // Using the primary color from CSS variables
  const primaryColor = 'var(--primary)';
  
  const tabStyle = (isActive: boolean) => ({
    padding: '10px 16px',
    border: 'none',
    borderBottom: isActive ? `2px solid ${primaryColor}` : '2px solid transparent',
    background: 'transparent',
    color: isActive ? primaryColor : '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'color 0.2s ease-in-out, border-color 0.2s ease-in-out'
  });

  return (
    <div style={{ padding: '0 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex' }}>
        <button
          style={tabStyle(activeTab === 'library')}
          onClick={() => onTabChange && onTabChange('library')}
        >
          <span role="img" aria-label="Voice Library Icon" style={{fontSize: '18px'}}>🎙️</span> Voice Library
        </button>
        <button
          style={tabStyle(activeTab === 'yourVoices')}
          onClick={() => onTabChange && onTabChange('yourVoices')}
        >
          <span role="img" aria-label="Your Voices Icon" style={{fontSize: '18px'}}>👤</span> Your Voices
        </button>
      </div>
      {/* Tab content would typically go here or be managed by a parent component based on activeTab */}
    </div>
  );
};

export default VoicesTabs;
