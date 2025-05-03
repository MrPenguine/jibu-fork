"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAPI } from './api';

// Define the organization interface
export interface Organization {
  id: string;
  name: string;
  role: string;
  status?: string;
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

// Define invitation interface
export interface Invitation {
  id: string;
  organization: {
    id: string;
    name: string;
  };
  role: string;
  invitedBy: {
    id: string;
    email: string;
    fullName?: string;
  };
  invitedAt: string;
  expiresAt: string;
  message?: string;
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
  incomingInvitations: Invitation[];
  switchOrganization: (org: Organization) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  updateOrganization: (orgId: string, data: OrganizationUpdateData) => Promise<Organization>;
  deleteOrganization: (orgId: string) => Promise<void>;
  inviteMembers: (orgId: string, emails: string[], role: string, message?: string) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
}

// Create the context with default values
const OrganizationContext = createContext<OrganizationContextType>({
  activeOrganization: null,
  organizations: [],
  loading: true,
  error: null,
  incomingInvitations: [],
  switchOrganization: async () => {},
  refreshOrganizations: async () => {},
  updateOrganization: async () => ({ id: '', name: '', role: '' }),
  deleteOrganization: async () => {},
  inviteMembers: async () => {},
  acceptInvitation: async () => {},
  rejectInvitation: async () => {},
});

// Custom hook to use the organization context
export const useOrganization = () => useContext(OrganizationContext);

// Organization provider component
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch invitations
  const fetchInvitations = async () => {
    try {
      const invitationsData = await fetchAPI('/invitations');
      console.log('Invitations fetched:', invitationsData);
      setIncomingInvitations(invitationsData || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      // Just log the error, don't set the error state, as this is auxiliary data
    }
  };

  // Function to fetch organizations and active org
  const refreshOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all organizations first
      const orgsData = await fetchAPI('/organizations');
      console.log('Organizations fetched:', orgsData);
      
      // Ensure that each organization has its status field (default to "active" if not set)
      const organizationsWithStatus = orgsData.map((org: Organization) => ({
        ...org,
        status: org.status || 'active'
      }));
      
      setOrganizations(organizationsWithStatus);
      
      // Fetch invitations
      await fetchInvitations();
      
      if (organizationsWithStatus.length === 0) {
        console.log('User has no organizations');
        setActiveOrganization(null);
        setLoading(false);
        return;
      }
      
      // Targeted logging for org persistence
      let activeOrgId = null;
      try {
        activeOrgId = localStorage.getItem('activeOrganizationId');
      } catch (storageError) {
        console.error('Error reading from localStorage:', storageError);
      }
      console.log(`[CONTEXT INIT] Read from localStorage:`, activeOrgId);
      console.log(`[CONTEXT INIT] Fetched orgs:`, organizationsWithStatus.map((o: Organization) => ({id: o.id, name: o.name})));
      
      if (activeOrgId) {
        const activeOrg = organizationsWithStatus.find(
          (org: Organization) => org.id === activeOrgId
        );
        console.log(`[CONTEXT INIT] Result of finding org with ID ${activeOrgId}:`, activeOrg ? activeOrg.id : 'NOT FOUND');
        if (activeOrg) {
          console.log(`[CONTEXT INIT] Setting active org from localStorage: ${activeOrg.id}`);
          setActiveOrganization(activeOrg);
          setLoading(false);
          return;
        } else {
          console.warn(`[CONTEXT INIT] Org ID ${activeOrgId} found in localStorage BUT NOT in fetched list!`);
        }
      }
      
      console.log('[CONTEXT INIT] Setting active org to NULL.');
      setActiveOrganization(null);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch organizations');
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
    console.log('Switching organization in OrganizationContext:', org.name);
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
    // No reload or sessionStorage logic needed
  };

  // Function to invite members to an organization
  const inviteMembers = async (orgId: string, emails: string[], role: string, message?: string) => {
    try {
      const response = await fetchAPI(`/organizations/${orgId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          emails,
          role,
          message
        })
      });
      
      // Refresh organizations to get updated membership data
      await refreshOrganizations();
      
      return response;
    } catch (error) {
      console.error('Error inviting members:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite members';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Function to accept an invitation
  const acceptInvitation = async (invitationId: string) => {
    try {
      await fetchAPI(`/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' })
      });
      
      // Refresh organizations to include the newly accepted organization
      await refreshOrganizations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invitation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Function to reject an invitation
  const rejectInvitation = async (invitationId: string) => {
    try {
      await fetchAPI(`/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject' })
      });
      
      // Remove the invitation from the list
      setIncomingInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation.id !== invitationId)
      );
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject invitation';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
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
        incomingInvitations,
        switchOrganization,
        refreshOrganizations,
        updateOrganization,
        deleteOrganization,
        inviteMembers,
        acceptInvitation,
        rejectInvitation,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
} 