"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from './supabase/client';
import { API_BASE_URL, getActiveOrganizationId } from './api';
import { Organization, OrganizationUpdateData } from './organizationContext';

// Define the user interface
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

// Define the API context interface
interface ApiContextType {
  user: User | null;
  token: string | null;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  membershipStatus: string | null;
  organizations: Organization[];
  activeOrganization: Organization | null;
  loading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  switchOrganization: (org: Organization) => Promise<void>;
  updateOrganization: (orgId: string, data: OrganizationUpdateData) => Promise<Organization>;
  deleteOrganization: (orgId: string) => Promise<void>;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

// Create the context with default values
const ApiContext = createContext<ApiContextType>({
  user: null,
  token: null,
  orgId: null,
  orgName: null,
  orgRole: null,
  membershipStatus: null,
  organizations: [],
  activeOrganization: null,
  loading: true,
  error: null,
  refreshContext: async () => {},
  switchOrganization: async () => {},
  updateOrganization: async () => ({ id: '', name: '', role: '' }),
  deleteOrganization: async () => {},
  apiRequest: async () => ({}),
});

// Custom hook to use the API context
export const useApi = () => useContext(ApiContext);

// API provider component
export function ApiProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standard API request function with auth token and org context
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Include active organization ID in headers
    const activeOrgId = getActiveOrganizationId();
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(activeOrgId ? { 'X-Organization-ID': activeOrgId } : {}),
      ...options.headers,
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Ignore JSON parsing errors
      }
      throw new Error(errorMessage);
    }
    
    // Check if response is empty
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };

  // Function to refresh user, token and organization context
  const refreshContext = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setUser(null);
        setToken(null);
        setOrgId(null);
        setOrgName(null);
        setOrgRole(null);
        setMembershipStatus(null);
        setOrganizations([]);
        setActiveOrganization(null);
        setLoading(false);
        return;
      }
      
      // Set token
      setToken(sessionData.session.access_token);
      
      // Fetch user context from API
      const response = await fetch('/api/auth/get-user-context');
      
      if (!response.ok) {
        throw new Error('Failed to fetch user context');
      }
      
      const context = await response.json();
      
      // Set user and organization info
      setUser(context.user);
      setOrgId(context.orgId);
      setOrgName(context.orgName);
      setOrgRole(context.orgRole);
      setMembershipStatus(context.membershipStatus);
      
      // Get all organizations
      const orgsResponse = await fetch(`${API_BASE_URL}/organizations`, {
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!orgsResponse.ok) {
        throw new Error('Failed to fetch organizations');
      }
      
      const orgsData = await orgsResponse.json();
      setOrganizations(orgsData);
      
      // Set active organization
      if (context.orgId) {
        const activeOrg = orgsData.find((org: Organization) => org.id === context.orgId);
        if (activeOrg) {
          setActiveOrganization(activeOrg);
          
          // Update localStorage for consistency
          try {
            localStorage.setItem('activeOrganizationId', activeOrg.id);
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
        }
      }
    } catch (err) {
      console.error('Error refreshing context:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh context');
    } finally {
      setLoading(false);
    }
  };

  // Function to switch active organization
  const switchOrganization = async (org: Organization) => {
    try {
      setActiveOrganization(org);
      setOrgId(org.id);
      setOrgName(org.name);
      setOrgRole(org.role);
      setMembershipStatus(org.status || 'active');
      
      // Store in localStorage
      try {
        localStorage.setItem('activeOrganizationId', org.id);
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError);
      }
      
      // Update on backend
      await apiRequest('/users/last-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: org.id }),
      });
    } catch (error) {
      console.error('Error switching organization:', error);
      setError(error instanceof Error ? error.message : 'Failed to switch organization');
    }
  };

  // Function to update an organization
  const updateOrganization = async (orgId: string, data: OrganizationUpdateData): Promise<Organization> => {
    try {
      // Update organization via API
      const updatedOrg = await apiRequest(`/organizations/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      // Update local state
      setOrganizations(prevOrgs => 
        prevOrgs.map(org => 
          org.id === orgId ? { ...org, ...updatedOrg } : org
        )
      );
      
      // Update active organization if needed
      if (activeOrganization?.id === orgId) {
        setActiveOrganization(prevOrg => 
          prevOrg ? { ...prevOrg, ...updatedOrg } : null
        );
        setOrgName(updatedOrg.name);
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
      // Delete via API
      await apiRequest(`/organizations/${orgId}`, {
        method: 'DELETE',
      });
      
      // Update local state
      setOrganizations(prevOrgs => prevOrgs.filter(org => org.id !== orgId));
      
      // If the active organization was deleted, set active to null or another org
      if (activeOrganization?.id === orgId) {
        const remainingOrgs = organizations.filter(org => org.id !== orgId);
        
        if (remainingOrgs.length > 0) {
          await switchOrganization(remainingOrgs[0]);
        } else {
          setActiveOrganization(null);
          setOrgId(null);
          setOrgName(null);
          setOrgRole(null);
          setMembershipStatus(null);
          
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

  // Initialize context on mount
  useEffect(() => {
    refreshContext();
    
    // Subscribe to auth changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshContext();
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Context value to provide
  const contextValue: ApiContextType = {
    user,
    token,
    orgId,
    orgName,
    orgRole,
    membershipStatus,
    organizations,
    activeOrganization,
    loading,
    error,
    refreshContext,
    switchOrganization,
    updateOrganization,
    deleteOrganization,
    apiRequest,
  };

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
} 