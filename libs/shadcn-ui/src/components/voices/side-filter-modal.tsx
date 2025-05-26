"use client";

import React, { useState, useEffect } from 'react';
import { VoiceFilters } from './voices-filter-modal';
import { getVoices, VoiceData } from '../../../../../apps/frontend/src/utils/voicesApi';

interface SideFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: VoiceFilters, count?: number) => void;
  selectedProvider?: string;
}

// We'll fetch real data from the API instead of using mock data

export const SideFilterModal: React.FC<SideFilterModalProps> = ({ isOpen, onClose, onApplyFilters, selectedProvider = 'All' }) => {
  const [language, setLanguage] = useState('');
  const [accent, setAccent] = useState('');
  const [gender, setGender] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>(['All']);
  const [voices, setVoices] = useState<VoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  
  // Fetch voices from API
  useEffect(() => {
    const fetchVoicesData = async () => {
      try {
        setIsLoading(true);
        const voicesData = await getVoices();
        setVoices(voicesData);
        setFilteredCount(voicesData.length);
      } catch (error) {
        console.error('Error fetching voices:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVoicesData();
  }, []);
  
  // Calculate filtered count based on current filters
  const calculateFilteredCount = () => {
    if (voices.length === 0) return 0;
    
    let filtered = [...voices];
    
    // Apply language filter
    if (language) {
      filtered = filtered.filter(voice => voice.language === language);
    }
    
    // Apply accent filter
    if (accent) {
      filtered = filtered.filter(voice => voice.accent === accent);
    }
    
    // Apply gender filter
    if (gender.length > 0) {
      filtered = filtered.filter(voice => gender.includes(voice.gender));
    }
    
    // Apply provider filter
    if (providers.length > 0 && !providers.includes('All')) {
      filtered = filtered.filter(voice => providers.includes(voice.provider));
    }
    
    // If a specific provider is selected from the categories
    if (selectedProvider !== 'All') {
      filtered = filtered.filter(voice => voice.provider === selectedProvider);
    }
    
    // Get the count of items that would be shown on the current page
    // This ensures the count matches what's actually visible in the list
    const itemsPerPage = 5; // Same as in VoicesList
    const currentPage = 1; // Assume first page for the count
    const totalItems = filtered.length;
    
    // Calculate how many items would be shown on the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const visibleItems = endIndex - startIndex;
    
    // Return the total count, not just the visible items
    // This gives users an accurate count of all matching voices
    return totalItems;
  };
  
  // Update filtered count whenever filters change
  useEffect(() => {
    setFilteredCount(calculateFilteredCount());
  }, [language, accent, gender, providers]);
  
  // Initialize providers based on selectedProvider when modal opens
  useEffect(() => {
    if (isOpen) {
      if (selectedProvider === 'All') {
        setProviders(['All']);
      } else {
        setProviders([selectedProvider]);
      }
    }
  }, [isOpen, selectedProvider]);
  
  // Reset filters when modal is closed
  useEffect(() => {
    if (!isOpen) {
      // Don't reset filters when closing to preserve selections
    }
  }, [isOpen]);
  
  const handleReset = () => {
    setLanguage('');
    setAccent('');
    setGender([]);
    setProviders(['All']);
    // Filtered count will be updated automatically via useEffect
  };
  
  const handleApply = () => {
    // Create filters object
    const filters: VoiceFilters = {
      language,
      accent,
      gender,
      useCase: [] // Not used in the side filter modal
    };
    
    // Calculate the filtered count one more time to ensure it's accurate
    const count = calculateFilteredCount();
    
    // Apply the filters and pass the count
    onApplyFilters(filters, count);
    
    // Close the modal
    onClose();
  };
  
  const handleGenderToggle = (value: string) => {
    if (gender.includes(value)) {
      setGender(gender.filter(g => g !== value));
    } else {
      setGender([...gender, value]);
    }
  };
  
  const handleProviderToggle = (value: string) => {
    if (value === 'All') {
      // If 'All' is clicked and not already selected, select only 'All'
      if (!providers.includes('All')) {
        setProviders(['All']);
      }
      // If 'All' is already selected, deselect it (but don't allow empty selection)
      else if (providers.length > 1) {
        setProviders([]);
      }
    } else {
      // If a specific provider is clicked
      if (providers.includes(value)) {
        // Remove this provider
        const newProviders = providers.filter(p => p !== value);
        // If removing this would leave no providers selected, select 'All'
        setProviders(newProviders.length === 0 ? ['All'] : newProviders);
      } else {
        // Add this provider and remove 'All' if it was selected
        const newProviders = [...providers.filter(p => p !== 'All'), value];
        setProviders(newProviders);
      }
    }
  };
  
  // Get accents based on selected language
  const getAccents = () => {
    const baseOptions = [{ value: '', label: 'Select an accent' }];
    
    if (language === 'english') {
      return [
        ...baseOptions,
        { value: 'american', label: 'American' },
        { value: 'british', label: 'British' },
        { value: 'australian', label: 'Australian' },
        { value: 'irish', label: 'Irish' },
        { value: 'us-southern', label: 'US Southern' },
      ];
    } else if (language === 'italian') {
      return [
        ...baseOptions,
        { value: 'italian', label: 'Italian' },
      ];
    } else if (language === 'swedish') {
      return [
        ...baseOptions,
        { value: 'swedish', label: 'Swedish' },
      ];
    }
    
    return baseOptions;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop with blur effect */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      
      {/* Filter panel */}
      <div 
        className="relative w-[30%] bg-white h-full overflow-y-auto shadow-xl animate-slide-in-right"
        style={{ 
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Filter Voices</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleReset}
                className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
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
          </div>
          
          {/* Language */}
          <div className="mb-6">
            <label className="block text-sm font-medium uppercase tracking-wider mb-2">Language</label>
            <div className="relative">
              <select 
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setAccent(''); // Reset accent when language changes
                }}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none pr-10"
              >
                <option value="">Select a language</option>
                <option value="english">English</option>
                <option value="italian">Italian</option>
                <option value="swedish">Swedish</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Accent */}
          <div className="mb-6">
            <label className="block text-sm font-medium uppercase tracking-wider mb-2">Accent</label>
            <div className="relative">
              <select 
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none pr-10"
                disabled={!language} // Disable if no language selected
              >
                {getAccents().map(acc => (
                  <option key={acc.value} value={acc.value}>{acc.label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Gender */}
          <div className="mb-6">
            <label className="block text-sm font-medium uppercase tracking-wider mb-2">Gender</label>
            <div className="grid grid-cols-3 gap-3">
              <div 
                onClick={() => handleGenderToggle('female')}
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${gender.includes('female') ? 'bg-primary bg-opacity-10 border-primary' : 'bg-gray-50 border-gray-200'} border`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${gender.includes('female') ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {gender.includes('female') && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <span>Female</span>
              </div>
              
              <div 
                onClick={() => handleGenderToggle('male')}
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${gender.includes('male') ? 'bg-primary bg-opacity-10 border-primary' : 'bg-gray-50 border-gray-200'} border`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${gender.includes('male') ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {gender.includes('male') && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <span>Male</span>
              </div>
              
              <div 
                onClick={() => handleGenderToggle('neutral')}
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${gender.includes('neutral') ? 'bg-primary bg-opacity-10 border-primary' : 'bg-gray-50 border-gray-200'} border`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${gender.includes('neutral') ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {gender.includes('neutral') && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <span>Neutral</span>
              </div>
            </div>
          </div>
          
          {/* Provider Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium uppercase tracking-wider mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {['All', 'Azure', 'ElevenLabs', 'Google', 'OpenAI'].map(provider => (
                <div 
                  key={provider}
                  onClick={() => handleProviderToggle(provider)}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${providers.includes(provider) ? 'bg-primary bg-opacity-10 border-primary' : 'bg-gray-50 border-gray-200'} border`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${providers.includes(provider) ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                    {providers.includes(provider) && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <span>{provider}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Filter Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Current Filters:</h3>
            <ul className="space-y-1 text-sm">
              {language && <li>• Language: <span className="font-medium">{language}</span></li>}
              {accent && <li>• Accent: <span className="font-medium">{accent}</span></li>}
              {gender.length > 0 && (
                <li>• Gender: <span className="font-medium">{gender.join(', ')}</span></li>
              )}
              {providers.length > 0 && !providers.includes('All') && (
                <li>• Provider: <span className="font-medium">{providers.join(', ')}</span></li>
              )}
              {selectedProvider !== 'All' && (
                <li>• Selected Provider: <span className="font-medium">{selectedProvider}</span></li>
              )}
              {!language && !accent && gender.length === 0 && (providers.includes('All') || providers.length === 0) && selectedProvider === 'All' && (
                <li className="text-gray-500">No filters applied</li>
              )}
            </ul>
          </div>
          
          {/* Apply Button */}
          <button 
            onClick={handleApply}
            className="w-full py-3 rounded-full text-white font-medium"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Show Results
          </button>
          
          {/* Results Count with loading indicator */}
          <div className="text-center mt-3 mb-2">
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                <span className="text-sm text-muted-foreground">Loading voices...</span>
              </div>
            ) : (
              <div className="text-sm">
                <span className="font-medium text-primary">{filteredCount}</span> 
                <span className="text-muted-foreground"> {filteredCount === 1 ? 'voice' : 'voices'} found</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideFilterModal;

// Add this to your global CSS or inline here
const slideInRightKeyframes = `
@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
`;

// Add the keyframes to the document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = slideInRightKeyframes;
  document.head.appendChild(style);
}
