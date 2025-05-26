"use client";

import React, { useState } from 'react';

interface VoicesFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: VoiceFilters, count?: number) => void;
}

export interface VoiceFilters {
  language: string;
  accent: string;
  gender: string[];
  useCase: string[];
}

const languages = [
  { value: 'english', label: 'English' },
  { value: 'italian', label: 'Italian' },
  { value: 'swedish', label: 'Swedish' },
];

const accents = [
  { value: 'british', label: 'British' },
  { value: 'american', label: 'American' },
  { value: 'australian', label: 'Australian' },
  { value: 'irish', label: 'Irish' },
  { value: 'swedish', label: 'Swedish' },
  { value: 'italian', label: 'Italian' },
  { value: 'us-southern', label: 'US Southern' },
];

const useCaseCategories = [
  'Advertising',
  'Conversational',
  'Educational',
  'Entertainment',
  'Narrative',
  'Character',
  'Premade',
  'Generated',
  'Cloned',
];

export const VoicesFilterModal: React.FC<VoicesFilterModalProps> = ({ isOpen, onClose, onApplyFilters }) => {
  const [language, setLanguage] = useState('');
  const [accent, setAccent] = useState('');
  const [gender, setGender] = useState<string[]>([]);
  const [useCase, setUseCase] = useState<string[]>([]);
  
  const primaryColor = 'var(--primary)';
  
  const handleGenderToggle = (value: string) => {
    if (gender.includes(value)) {
      setGender(gender.filter(g => g !== value));
    } else {
      setGender([...gender, value]);
    }
  };
  
  const handleUseCaseToggle = (value: string) => {
    if (useCase.includes(value)) {
      setUseCase(useCase.filter(uc => uc !== value));
    } else {
      setUseCase([...useCase, value]);
    }
  };
  
  const handleReset = () => {
    setLanguage('');
    setAccent('');
    setGender([]);
    setUseCase([]);
  };
  
  const handleApply = () => {
    onApplyFilters({
      language,
      accent,
      gender,
      useCase,
    });
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
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
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none pr-10"
            >
              <option value="">Select a language</option>
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
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
            >
              <option value="">Select an accent</option>
              {accents.map(acc => (
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
          <div className="flex gap-4">
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
          </div>
        </div>
        
        {/* Use Case Category */}
        <div className="mb-6">
          <label className="block text-sm font-medium uppercase tracking-wider mb-2">Use Case Category</label>
          <div className="grid grid-cols-2 gap-3">
            {useCaseCategories.map(category => (
              <div 
                key={category}
                onClick={() => handleUseCaseToggle(category)}
                className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer ${useCase.includes(category) ? 'bg-primary bg-opacity-10 border-primary' : 'bg-gray-50 border-gray-200'} border`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${useCase.includes(category) ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {useCase.includes(category) && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <span>{category}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Apply Button */}
        <button 
          onClick={handleApply}
          className="w-full py-3 rounded-full text-white font-medium"
          style={{ backgroundColor: primaryColor }}
        >
          Show Results
        </button>
      </div>
    </div>
  );
};

export default VoicesFilterModal;
