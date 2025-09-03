"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAPI } from './api';

// Define the workspace interface
export interface Workspace {
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
  workspace: {
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

// Define workspace update interface
export interface WorkspaceUpdateData {
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
interface WorkspaceContextType {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  incomingInvitations: Invitation[];
  switchWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  updateWorkspace: (workspaceId: string, data: WorkspaceUpdateData) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  inviteMembers: (workspaceId: string, emails: string[], role: string, message?: string) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
}

// Create the context with default values
const WorkspaceContext = createContext<WorkspaceContextType>({
  activeWorkspace: null,
  workspaces: [],
  loading: true,
  error: null,
  incomingInvitations: [],
  switchWorkspace: async () => {},
  refreshWorkspaces: async () => {},
  updateWorkspace: async () => ({ id: '', name: '', role: '' }),
  deleteWorkspace: async () => {},
  inviteMembers: async () => {},
  acceptInvitation: async () => {},
  rejectInvitation: async () => {},
});

// Custom hook to use the workspace context
export const useWorkspace = () => useContext(WorkspaceContext);

// Workspace provider component
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch invitations
  const fetchInvitations = async () => {
    try {
      const invitationsData = await fetchAPI('/workspaces/invitations');
      console.log('Invitations fetched:', invitationsData);
      setIncomingInvitations(invitationsData || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      // Just log the error, don't set the error state, as this is auxiliary data
    }
  };

  // Function to fetch workspaces and active workspace
  const refreshWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all workspaces first
      const workspacesData = await fetchAPI('/workspaces');
      console.log('Workspaces fetched:', workspacesData);
      
      // Ensure that each workspace has its status field (default to "active" if not set)
      const workspacesWithStatus = workspacesData.map((workspace: Workspace) => ({
        ...workspace,
        status: workspace.status || 'active'
      }));
      
      setWorkspaces(workspacesWithStatus);
      
      // Fetch invitations
      await fetchInvitations();
      
      if (workspacesWithStatus.length === 0) {
        console.log('User has no workspaces');
        setActiveWorkspace(null);
        setLoading(false);
        return;
      }
      
      // Filter out any pending workspaces to get active ones only
      const activeWorkspaces = workspacesWithStatus.filter(
        (workspace: Workspace) => !workspace.status || workspace.status === 'active'
      );
      console.log(`[CONTEXT INIT] Active workspaces:`, activeWorkspaces.map((w: Workspace) => ({id: w.id, name: w.name})));
      
      // Targeted logging for workspace persistence
      let activeWorkspaceId = null;
      try {
        activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
      } catch (storageError) {
        console.error('Error reading from localStorage:', storageError);
      }
      console.log(`[CONTEXT INIT] Read from localStorage:`, activeWorkspaceId);
      console.log(`[CONTEXT INIT] Fetched workspaces:`, workspacesWithStatus.map((w: Workspace) => ({id: w.id, name: w.name})));
      
      // Try to find the active workspace from localStorage
      if (activeWorkspaceId) {
        const activeWorkspace = workspacesWithStatus.find(
          (workspace: Workspace) => workspace.id === activeWorkspaceId
        );
        console.log(`[CONTEXT INIT] Result of finding workspace with ID ${activeWorkspaceId}:`, activeWorkspace ? activeWorkspace.id : 'NOT FOUND');
        if (activeWorkspace) {
          console.log(`[CONTEXT INIT] Setting active workspace from localStorage: ${activeWorkspace.id}`);
          setActiveWorkspace(activeWorkspace);
          setLoading(false);
          return;
        } else {
          console.warn(`[CONTEXT INIT] Workspace ID ${activeWorkspaceId} found in localStorage BUT NOT in fetched list!`);
        }
      }
      
      // If no active workspace is found in localStorage, try to find a suitable one
      
      // First try to find a workspace where the user is an owner
      const ownedWorkspace = activeWorkspaces.find((workspace: Workspace) => workspace.role === 'owner');
      
      if (ownedWorkspace) {
        console.log(`[CONTEXT INIT] No active workspace in localStorage, setting to an owned workspace: ${ownedWorkspace.id}`);
        setActiveWorkspace(ownedWorkspace);
        
        // Store this selection in localStorage
        try {
          localStorage.setItem('activeWorkspaceId', ownedWorkspace.id);
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
        
        setLoading(false);
        return;
      }
      
      // If no owned workspace, use the first active workspace
      if (activeWorkspaces.length > 0) {
        console.log(`[CONTEXT INIT] No owned workspace, setting to first active workspace: ${activeWorkspaces[0].id}`);
        setActiveWorkspace(activeWorkspaces[0]);
        
        // Store this selection in localStorage
        try {
          localStorage.setItem('activeWorkspaceId', activeWorkspaces[0].id);
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
        
        setLoading(false);
        return;
      }
      
      // If we still don't have an active workspace, just use the first one
      if (workspacesWithStatus.length > 0) {
        console.log(`[CONTEXT INIT] No active workspaces, setting to first available workspace: ${workspacesWithStatus[0].id}`);
        setActiveWorkspace(workspacesWithStatus[0]);
        
        // Store this selection in localStorage
        try {
          localStorage.setItem('activeWorkspaceId', workspacesWithStatus[0].id);
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
        }
        
        setLoading(false);
        return;
      }
      
      console.log('[CONTEXT INIT] Setting active workspace to NULL.');
      setActiveWorkspace(null);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch workspaces');
    } finally {
      setLoading(false);
    }
  };

  // Function to update a workspace
  const updateWorkspace = async (workspaceId: string, data: WorkspaceUpdateData): Promise<Workspace> => {
    try {
      // Call the API to update the workspace
      const updatedWorkspace = await fetchAPI(`/workspaces/${workspaceId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
      // Update the workspaces list with the new data
      setWorkspaces(prevWorkspaces => 
        prevWorkspaces.map(workspace => 
          workspace.id === workspaceId ? { ...workspace, ...updatedWorkspace } : workspace
        )
      );
      
      // If the active workspace was updated, update it too
      if (activeWorkspace?.id === workspaceId) {
        setActiveWorkspace(prevWorkspace => 
          prevWorkspace ? { ...prevWorkspace, ...updatedWorkspace } : null
        );
      }
      
      return updatedWorkspace;
    } catch (error) {
      console.error('Error updating workspace:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update workspace';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };
  
  // Function to delete a workspace
  const deleteWorkspace = async (workspaceId: string): Promise<void> => {
    try {
      // Call the API to delete the workspace
      await fetchAPI(`/workspaces/${workspaceId}`, {
        method: 'DELETE'
      });
      
      // Remove the workspace from the list
      setWorkspaces(prevWorkspaces => prevWorkspaces.filter(workspace => workspace.id !== workspaceId));
      
      // If the active workspace was deleted, set active to null or another workspace
      if (activeWorkspace?.id === workspaceId) {
        const remainingWorkspaces = workspaces.filter(workspace => workspace.id !== workspaceId);
        
        if (remainingWorkspaces.length > 0) {
          setActiveWorkspace(remainingWorkspaces[0]);
          
          // Update localStorage
          try {
            localStorage.setItem('activeWorkspaceId', remainingWorkspaces[0].id);
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
        } else {
          setActiveWorkspace(null);
          
          // Clear localStorage
          try {
            localStorage.removeItem('activeWorkspaceId');
          } catch (storageError) {
            console.error('Error clearing localStorage:', storageError);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workspace';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Function to switch active workspace
  const switchWorkspace = async (workspace: Workspace) => {
    console.log('Switching workspace in WorkspaceContext:', workspace.name);
    setActiveWorkspace(workspace);
    
    // Store in localStorage and sessionStorage for redundancy
    try {
      localStorage.setItem('activeWorkspaceId', workspace.id);
      sessionStorage.setItem('activeWorkspaceId', workspace.id);
      console.log(`[workspaceContext] Workspace ID stored in both storages: ${workspace.id}`);
    } catch (storageError) {
      console.error('Error saving to storage:', storageError);
    }
    
    // Try to update on the backend
    try {
      await fetchAPI('/users/last-workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace.id })
      });
    } catch (apiError) {
      console.warn('Could not update workspace on backend:', apiError);
      // The context is updated, and components relying on it should reactively update.
    }
  };

  // Function to invite members to a workspace
  const inviteMembers = async (workspaceId: string, emails: string[], role: string, message?: string) => {
    try {
      const response = await fetchAPI(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          emails,
          role,
          message
        })
      });
      
      // Refresh workspaces to get updated membership data
      await refreshWorkspaces();
      
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
      await fetchAPI(`/workspaces/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' })
      });
      
      // Refresh workspaces to include the newly accepted workspace
      await refreshWorkspaces();
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
      await fetchAPI(`/workspaces/invitations/${invitationId}/respond`, {
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

  // Fetch workspaces on initial load
  useEffect(() => {
    refreshWorkspaces();
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces,
        loading,
        error,
        incomingInvitations,
        switchWorkspace,
        refreshWorkspaces,
        updateWorkspace,
        deleteWorkspace,
        inviteMembers,
        acceptInvitation,
        rejectInvitation,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
