"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAPI } from './api';

// Define the organization interface
export interface Organization {
  id: string;
  name: string;
  role: string;
}

// Define the context interface
interface OrganizationContextType {
  activeOrganization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  switchOrganization: (org: Organization) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

// Create the context with default values
const OrganizationContext = createContext<OrganizationContextType>({
  activeOrganization: null,
  organizations: [],
  loading: true,
  error: null,
  switchOrganization: async () => {},
  refreshOrganizations: async () => {},
});

// Custom hook to use the organization context
export const useOrganization = () => useContext(OrganizationContext);

// Organization provider component
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch organizations and active org
  const refreshOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all organizations first
      const orgsData = await fetchAPI('/organizations');
      console.log('Organizations fetched:', orgsData);
      setOrganizations(orgsData);
      
      if (orgsData.length === 0) {
        console.warn('User has no organizations');
        setLoading(false);
        return;
      }
      
      // Try to get active organization ID from localStorage
      let activeOrgId = null;
      try {
        activeOrgId = localStorage.getItem('activeOrganizationId');
      } catch (storageError) {
        console.error('Error reading from localStorage:', storageError);
      }
      
      // If we have an active organization ID in localStorage, use it
      if (activeOrgId) {
        const activeOrg = orgsData.find(
          (org: Organization) => org.id === activeOrgId
        );
        
        if (activeOrg) {
          setActiveOrganization(activeOrg);
          return;
        }
      }
      
      // If no active org in localStorage, try user data from API
      try {
        const userData = await fetchAPI('/users/me');
        
        if (userData && userData.lastOrganizationId) {
          const activeOrgFromApi = orgsData.find(
            (org: Organization) => org.id === userData.lastOrganizationId
          );
          
          if (activeOrgFromApi) {
            setActiveOrganization(activeOrgFromApi);
            
            // Update localStorage for consistency
            try {
              localStorage.setItem('activeOrganizationId', activeOrgFromApi.id);
            } catch (storageError) {
              console.error('Error saving to localStorage:', storageError);
            }
            
            return;
          }
        }
        
        // If neither localStorage nor API has a valid active org, use the first one
        setActiveOrganization(orgsData[0]);
        
        // Store the first org ID in localStorage
        try {
          localStorage.setItem('activeOrganizationId', orgsData[0].id);
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
        
        // Fallback to first organization
        setActiveOrganization(orgsData[0]);
        
        // Store in localStorage
        try {
          localStorage.setItem('activeOrganizationId', orgsData[0].id);
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
      }
    } catch (err) {
      console.error('Error fetching organization data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organization data');
    } finally {
      setLoading(false);
    }
  };

  // Function to switch active organization
  const switchOrganization = async (org: Organization) => {
    setActiveOrganization(org);
    
    // Store in localStorage
    try {
      localStorage.setItem('activeOrganizationId', org.id);
    } catch (storageError) {
      console.error('Error saving to localStorage:', storageError);
    }
    
    // Try to update on the backend
    try {
      await fetchAPI('/users/update-last-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: org.id })
      });
    } catch (apiError) {
      console.warn('Could not update organization on backend:', apiError);
      // Continue even if API fails
    }
    
    // Force a hard refresh of the page to ensure all components update
    window.location.reload();
  };

  // Fetch organizations on initial load
  useEffect(() => {
    refreshOrganizations();
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganization,
        organizations,
        loading,
        error,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
} 