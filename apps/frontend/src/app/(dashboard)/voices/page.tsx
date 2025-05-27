"use client";

import React, { useState, useEffect } from 'react';
import { getVoices, VoiceData } from '../../../utils/voicesApi';
import {
  VoicesHeader,
  VoicesTabs,
  VoicesSearchFilter,
  VoicesCategories,
  VoicesList,
  CustomVoicesList,
  VoiceCloneTypeModal,
  VoiceFilters,
  SideFilterModal
} from '../../../../../../libs/shadcn-ui/src/components/voices';

const VoicesPage = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [allVoices, setAllVoices] = useState<VoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [voiceCounts, setVoiceCounts] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<VoiceFilters>({
    language: '',
    accent: '',
    gender: [],
    useCase: []
  });
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };
  
  const handleProviderSelect = (provider: string) => {
    if (provider === 'Create') {
      setActiveTab('yourVoices');
      setIsCloneModalOpen(true);
    } else {
      setSelectedProvider(provider);
    }
  };
  
  const handleCloseModal = () => {
    setIsCloneModalOpen(false);
  };
  
  const handleVoiceTypeSelect = (type: 'instant' | 'high-fidelity') => {
    console.log(`Selected voice type: ${type}`);
    setIsCloneModalOpen(false);
    // Here you would typically navigate to the voice creation flow with the selected type
  };
  
  // Fetch voices and calculate provider counts
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setIsLoading(true);
        const voices = await getVoices();
        setAllVoices(voices);
        
        // Calculate voice counts by provider
        const counts: Record<string, number> = { total: voices.length };
        
        voices.forEach(voice => {
          const provider = voice.provider;
          if (provider) {
            counts[provider] = (counts[provider] || 0) + 1;
          }
        });
        
        setVoiceCounts(counts);
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVoices();
  }, []);
  
  // Function to clear all filters
  const clearAllFilters = () => {
    // Reset filters to empty state
    const emptyFilters: VoiceFilters = {
      language: '',
      accent: '',
      gender: [],
      useCase: []
    };
    
    // Update filters state
    setFilters(emptyFilters);
    
    // Reset provider selection
    setSelectedProvider('All');
    
    // Reset active filters flag
    setHasActiveFilters(false);
    
    console.log('All filters cleared');
  };
  
  const handleFiltersChange = (newFilters: VoiceFilters, count?: number) => {
    setFilters(newFilters);
    
    // Update filtered count if provided
    if (count !== undefined) {
      setFilteredCount(count);
    }
    
    // If useCase filter is applied, update the selectedProvider to match
    if (newFilters.useCase.length === 1) {
      setSelectedProvider(newFilters.useCase[0]);
    } else if (newFilters.useCase.length === 0 && filters.useCase.length > 0) {
      // If useCase filter is cleared, reset provider to 'All'
      setSelectedProvider('All');
    }
    
    // Check if any filters are applied
    const filtersActive = !!(  // Convert to boolean with double negation
      newFilters.language || 
      newFilters.accent || 
      newFilters.gender.length > 0 || 
      newFilters.useCase.length > 0 ||
      selectedProvider !== 'All'
    );
    
    // Update active filters state
    setHasActiveFilters(filtersActive);
    
    console.log('Filters applied:', newFilters, 'Active:', filtersActive, 'Count:', count);
  };
  
  return (
    <div className="w-full h-full transition-all duration-200 ease-in-out">
      <div className="w-[90%] mx-auto">
        <VoicesHeader onCreateClick={() => setIsCloneModalOpen(true)} />
        <VoicesTabs activeTab={activeTab} onTabChange={handleTabChange} />
        
        {/* Only show filters for the library tab, not for custom voices */}
        {activeTab === 'library' && (
          <>
            <VoicesSearchFilter 
              onFiltersChange={handleFiltersChange} 
              onFilterClick={() => setIsFilterModalOpen(true)}
              onClearFilters={clearAllFilters}
              activeFilters={hasActiveFilters}
              filteredCount={filteredCount}
              filters={filters}
            />
            <VoicesCategories 
              selectedProvider={selectedProvider} 
              onProviderSelect={handleProviderSelect}
              voiceCounts={voiceCounts}
            />
          </>
        )}
        
        {activeTab === 'library' ? (
          <VoicesList 
            activeTab={activeTab}
            selectedProvider={selectedProvider}
            onFilterClick={() => setIsFilterModalOpen(true)}
            filters={filters}
            onFilteredCountChange={(count, hasActiveFilters) => {
              setFilteredCount(count);
              setHasActiveFilters(hasActiveFilters);
            }}
          />
        ) : (
          <CustomVoicesList />
        )}
      </div>
      
      <SideFilterModal 
        isOpen={isFilterModalOpen} 
        onClose={() => setIsFilterModalOpen(false)} 
        selectedProvider={selectedProvider}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          setIsFilterModalOpen(false);
          
          // Update the selectedProvider based on the provider selected in the modal
          if (newFilters.useCase.length === 1) {
            setSelectedProvider(newFilters.useCase[0]);
          } else if (newFilters.useCase.length === 0) {
            setSelectedProvider('All');
          }
        }}
      />
      
      <VoiceCloneTypeModal 
        isOpen={isCloneModalOpen}
        onClose={handleCloseModal}
        onSelect={handleVoiceTypeSelect}
      />
    </div>
  );
};

export default VoicesPage;
