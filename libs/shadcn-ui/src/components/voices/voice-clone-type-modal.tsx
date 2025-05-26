"use client";

import React from 'react';

interface VoiceCloneTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'instant' | 'high-fidelity') => void;
}

export const VoiceCloneTypeModal: React.FC<VoiceCloneTypeModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [selectedType, setSelectedType] = React.useState<'instant' | 'high-fidelity' | null>(null);
  
  if (!isOpen) return null;
  
  // Using primary color from CSS variables
  const primaryColor = 'var(--primary)';
  
  const handleSelect = (type: 'instant' | 'high-fidelity') => {
    // Just set the selected type, don't close the modal
    setSelectedType(type);
  };
  
  const handleContinue = () => {
    // Only call onSelect when the Continue button is clicked
    if (selectedType) {
      onSelect(selectedType);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create Custom Voice</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <p className="text-gray-600 mb-6">Choose the type of voice clone you want to create:</p>
        
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div 
            onClick={() => handleSelect('instant')}
            className="border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
            style={{ 
              borderColor: selectedType === 'instant' ? primaryColor : 'rgba(0,0,0,0.1)', 
              borderWidth: selectedType === 'instant' ? '2px' : '1px',
              backgroundColor: '#fafafa',
              boxShadow: selectedType === 'instant' ? `0 0 0 1px ${primaryColor}, 0 2px 8px rgba(0,0,0,0.05)` : '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Instant Clone</h3>
              <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">Fast</span>
            </div>
            <p className="text-gray-600 text-sm">Create a voice clone in seconds with just a 30-second audio sample. Great for quick projects.</p>
            <div className="mt-3 flex items-center">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span className="text-xs text-gray-500">Ready in 1 minute</span>
            </div>
          </div>
          
          <div 
            onClick={() => handleSelect('high-fidelity')}
            className="border rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
            style={{ 
              borderColor: selectedType === 'high-fidelity' ? primaryColor : 'rgba(0,0,0,0.1)', 
              borderWidth: selectedType === 'high-fidelity' ? '2px' : '1px',
              backgroundColor: '#fafafa',
              boxShadow: selectedType === 'high-fidelity' ? `0 0 0 1px ${primaryColor}, 0 2px 8px rgba(0,0,0,0.05)` : '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">High Fidelity Clone</h3>
              <span 
                className="px-3 py-1 text-white text-xs font-medium rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                Premium
              </span>
            </div>
            <p className="text-gray-600 text-sm">Create a professional-grade voice clone with 5+ minutes of audio. Superior quality and expressiveness.</p>
            <div className="mt-3 flex items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-xs text-gray-500">Ready in 24 hours</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button 
            onClick={handleContinue}
            className="px-6 py-2 text-white rounded-xl"
            style={{ 
              backgroundColor: primaryColor,
              opacity: selectedType ? 1 : 0.5,
              cursor: selectedType ? 'pointer' : 'not-allowed'
            }}
            disabled={!selectedType}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCloneTypeModal;
