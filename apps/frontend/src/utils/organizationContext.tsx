"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAPI } from './api';

// Define the organization interface
export interface Organization {
  id: string;
  name: string;
  role: string;
  email?: string;
  settings?: {
    channel?: string;
    callConcurrencyLimit?: number;
    hipaaEnabled?: boolean;
    pciEnabled?: boolean;
    serverUrl?: string;
    timeoutSeconds?: number;
    headers?: { name: string; value: string }[];
  };
}

// Define organization update interface
export interface OrganizationUpdateData {
  name?: string;
  email?: string;
  settings?: {
    channel?: string;
    callConcurrencyLimit?: number;
    hipaaEnabled?: boolean;
    pciEnabled?: boolean;
    serverUrl?: string;
    timeoutSeconds?: number;
    headers?: { name: string; value: string }[];
  };
}

// Define the context interface
interface OrganizationContextType {
  activeOrganization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  switchOrganization: (org: Organization) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  updateOrganization: (orgId: string, data: OrganizationUpdateData) => Promise<Organization>;
  deleteOrganization: (orgId: string) => Promise<void>;
}

// Create the context with default values
const OrganizationContext = createContext<OrganizationContextType>({
  activeOrganization: null,
  organizations: [],
  loading: true,
  error: null,
  switchOrganization: async () => {},
  refreshOrganizations: async () => {},
  updateOrganization: async () => ({ id: '', name: '', role: '' }),
  deleteOrganization: async () => {},
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

  // Function to update an organization
  const updateOrganization = async (orgId: string, data: OrganizationUpdateData): Promise<Organization> => {
    try {
      // Call the API to update the organization
      const updatedOrg = await fetchAPI(`/organizations/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
      // Update the organizations list with the new data
      setOrganizations(prevOrgs => 
        prevOrgs.map(org => 
          org.id === orgId ? { ...org, ...updatedOrg } : org
        )
      );
      
      // If the active organization was updated, update it too
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(prevOrg => 
          prevOrg ? { ...prevOrg, ...updatedOrg } : null
        );
      }
      
      return updatedOrg;
    } catch (error) {
      console.error('Error updating organization:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update organization';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Function to delete an organization
  const deleteOrganization = async (orgId: string): Promise<void> => {
    try {
      // Call the API to delete the organization
      await fetchAPI(`/organizations/${orgId}`, {
        method: 'DELETE'
      });
      
      // Remove the organization from the list
      setOrganizations(prevOrgs => prevOrgs.filter(org => org.id !== orgId));
      
      // If the active organization was deleted, set active to null or another org
      if (activeOrganization?.id === orgId) {
        const remainingOrgs = organizations.filter(org => org.id !== orgId);
        
        if (remainingOrgs.length > 0) {
          setActiveOrganization(remainingOrgs[0]);
          
          // Update localStorage
          try {
            localStorage.setItem('activeOrganizationId', remainingOrgs[0].id);
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
        } else {
          setActiveOrganization(null);
          
          // Clear localStorage
          try {
            localStorage.removeItem('activeOrganizationId');
          } catch (storageError) {
            console.error('Error clearing localStorage:', storageError);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete organization';
      setError(errorMessage);
      throw new Error(errorMessage);
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
      await fetchAPI('/users/last-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: org.id })
      });
    } catch (apiError) {
      console.warn('Could not update organization on backend:', apiError);
      // Continue even if API fails
    }
    
    // Force a soft reload to ensure the components update correctly
    // Use the current path to avoid redirecting the user
    const currentPath = window.location.pathname;
    window.location.href = currentPath;
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
        updateOrganization,
        deleteOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
} 