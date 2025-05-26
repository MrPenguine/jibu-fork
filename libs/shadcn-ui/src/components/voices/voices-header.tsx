"use client";

import React from 'react';

interface VoicesHeaderProps {
  onCreateClick?: () => void;
}

export const VoicesHeader: React.FC<VoicesHeaderProps> = ({ onCreateClick }) => {
  // Using the primary color from CSS variables
  const primaryColor = 'var(--primary)';
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 16px 16px 16px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Voices</h1>
      <button 
        onClick={onCreateClick || (() => console.log('Create Voice clicked'))}
        style={{
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: primaryColor,
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease-in-out'
        }}
        className="hover:bg-primary/90"
      >
        + Create Voice
      </button>
    </div>
  );
};

export default VoicesHeader;
