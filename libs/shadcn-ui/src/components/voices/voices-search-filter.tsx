"use client";

import React, { useState } from 'react';
// Import SideFilterModal from the index file instead of directly
import { SideFilterModal } from '.';
import { VoiceFilters } from './voices-filter-modal';

interface VoicesSearchFilterProps {
  onFiltersChange?: (filters: VoiceFilters, count?: number) => void;
  onFilterClick?: () => void;
  onClearFilters?: () => void;
  activeFilters?: boolean;
  filteredCount?: number;
  filters?: VoiceFilters; // External filters passed from parent
}

export const VoicesSearchFilter: React.FC<VoicesSearchFilterProps> = ({ 
  onFiltersChange, 
  onFilterClick, 
  onClearFilters,
  activeFilters: externalActiveFilters,
  filteredCount: externalFilteredCount,
  filters: externalFilters
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalActiveFilters, setInternalActiveFilters] = useState<VoiceFilters | null>(null);
  const [internalFilteredCount, setInternalFilteredCount] = useState<number | null>(null);
  
  // Use external state if provided, otherwise use internal state
  const activeFilters = externalActiveFilters !== undefined ? externalActiveFilters : internalActiveFilters !== null;
  const filteredCount = externalFilteredCount !== undefined ? externalFilteredCount : internalFilteredCount;
  
  const handleFilterToggle = () => {
    if (onFilterClick) {
      onFilterClick();
    } else {
      setIsFilterOpen(!isFilterOpen);
    }
  };
  
  const handleFiltersApply = (filters: VoiceFilters, count?: number) => {
    // Check if filters are active
    const hasActiveFilters = 
      filters.language || 
      filters.accent || 
      filters.gender.length > 0 || 
      filters.useCase.length > 0;
    
    // Update active filters state
    setInternalActiveFilters(hasActiveFilters ? filters : null);
    
    // Update filtered count if provided
    if (count !== undefined) {
      setInternalFilteredCount(count);
    }
    
    // Call the parent's onFiltersChange callback
    if (onFiltersChange) {
      onFiltersChange(filters, count);
    }
    
    setIsFilterOpen(false);
  };
  
  const clearFilters = () => {
    // Create empty filters
    const emptyFilters: VoiceFilters = {
      language: '',
      accent: '',
      gender: [],
      useCase: []
    };
    
    // Reset internal active filters
    setInternalActiveFilters(null);
    setInternalFilteredCount(null);
    
    // Call the parent's clear filters function if provided
    if (onClearFilters) {
      onClearFilters();
    } else if (onFiltersChange) {
      // Otherwise apply empty filters through the change handler
      onFiltersChange(emptyFilters);
    }
  };
  
  return (
    <>
      <div className="flex items-center justify-between w-full gap-4 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <input 
            type="search" 
            className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500" 
            placeholder="Search voices" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Clear Filter Button - Only show when filters are active */}
          {activeFilters && (
            <button 
              onClick={clearFilters} 
              className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </div>
            </button>
          )}
          
          {/* Filter Button */}
          <button 
            onClick={handleFilterToggle} 
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7.75 4H19M7.75 4a2.25 2.25 0 0 1-4.5 0m4.5 0a2.25 2.25 0 0 0-4.5 0M1 4h2.25m13.5 6H19m-2.25 0a2.25 2.25 0 0 1-4.5 0m4.5 0a2.25 2.25 0 0 0-4.5 0M1 10h11.25m-4.5 6H19M14.5 16a2.25 2.25 0 0 1-4.5 0m4.5 0a2.25 2.25 0 0 0-4.5 0M1 16h9"/>
              </svg>
              Filter
            </div>
          </button>
        </div>
      </div>
      
      {/* Show filtered count if available */}
      {activeFilters && filteredCount !== null && (
        <div className="mb-4 p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>
                <strong>{filteredCount}</strong> {filteredCount === 1 ? 'voice' : 'voices'} found
              </span>
              
              {/* Filter badges */}
              <div className="flex flex-wrap gap-1 ml-2">
                {/* Use external filters if available, otherwise use internal filters */}
                {(externalFilters?.language || internalActiveFilters?.language) && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    {externalFilters?.language || internalActiveFilters?.language}
                  </span>
                )}
                {(externalFilters?.accent || internalActiveFilters?.accent) && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    {externalFilters?.accent || internalActiveFilters?.accent}
                  </span>
                )}
                {/* Gender filters */}
                {(externalFilters?.gender || internalActiveFilters?.gender || []).map((g, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    {g}
                  </span>
                ))}
                {/* Provider/UseCase filters */}
                {(externalFilters?.useCase || internalActiveFilters?.useCase || []).map((uc, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    {uc}
                  </span>
                ))}
                
                {/* Check for models filter in the extended filters */}
                {((externalFilters as any)?.models?.length > 0 || (internalActiveFilters as any)?.models?.length > 0) && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    {(externalFilters as any)?.models?.length || (internalActiveFilters as any)?.models?.length} 
                    {((externalFilters as any)?.models?.length || (internalActiveFilters as any)?.models?.length) === 1 ? 'model' : 'models'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <SideFilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={(filters, count) => handleFiltersApply(filters, count)} 
      />
    </>
  );
};

export default VoicesSearchFilter;
