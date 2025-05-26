"use client";

import React from 'react';

interface VoicesPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const VoicesPagination: React.FC<VoicesPaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  // Using a primary color that can be referenced with CSS variables in a real app
  const primaryColor = 'var(--color-primary, #0284c7)';
  
  // Basic pagination display logic (can be enhanced)
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const buttonStyle = (isActive: boolean = false, disabled: boolean = false) => ({
    padding: '8px 12px',
    margin: '0 4px',
    backgroundColor: isActive ? primaryColor : '#ffffff',
    color: isActive ? 'white' : '#333',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease-in-out'
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', gap: '8px' }}>
      <button 
        onClick={() => onPageChange(Math.max(1, currentPage - 1))} 
        disabled={currentPage === 1}
        style={buttonStyle(false, currentPage === 1)}
      >
        Previous
      </button>
      {/* Render a few page numbers - simplified for now */}
      {pageNumbers.slice(0, Math.min(totalPages, 5)).map(number => (
        <button
          key={number}
          onClick={() => onPageChange(number)}
          style={buttonStyle(currentPage === number)}
        >
          {number}
        </button>
      ))}
      {totalPages > 5 && <span style={{color: '#666'}}>...</span>}
      <button 
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} 
        disabled={currentPage === totalPages}
        style={buttonStyle(false, currentPage === totalPages)}
      >
        Next
      </button>
    </div>
  );
};

export default VoicesPagination;
