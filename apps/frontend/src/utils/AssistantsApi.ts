import { fetchAPI, getActiveOrganizationId } from './api';
import { useOrganization } from './organizationContext';
import { createClient } from './supabase/client';

export interface Assistant {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  knowledgeBaseId?: string;
  firstMessage?: string;
  voicemailMessage?: string; // System prompt
  model?: any;
  hipaaEnabled?: boolean;
  backgroundDenoisingEnabled?: boolean;
  endCallPhrases?: string[];
  serverMessages?: string[];
  clientMessages?: string[];
}

interface CreateAssistantParams {
  name: string;
  templateId?: string;
  description?: string; // Maps to firstMessage
  systemPrompt?: string; // Maps to voicemailMessage
  knowledgeBaseId?: string;
}

interface UpdateAssistantParams {
  name?: string;
  description?: string; // Maps to firstMessage
  systemPrompt?: string; // Maps to voicemailMessage
  knowledgeBaseId?: string | null;
  hipaaEnabled?: boolean;
  config?: any;
}

/**
 * Transform backend Assistant model to frontend format
 */
const transformAssistant = (assistant: any): Assistant => {
  // Ensure all fields are properly mapped
  return {
    ...assistant,
    // Map database fields to frontend interface
    firstMessage: assistant.firstMessage || '',
    voicemailMessage: assistant.voicemailMessage || ''
  };
};

/**
 * Mock data for development when backend is not available
 */
const MOCK_ASSISTANTS: Assistant[] = [];

/**
 * Check if we should use mock data
 */
const shouldUseMockData = (error: any) => {
  // Check if the API is available
  if (error.message && (
    error.message.includes('404') || 
    error.message.includes('not found') ||
    error.message.toLowerCase().includes('cannot get')
  )) {
    console.log('API endpoint not available, using mock data');
    return true;
  }
  return false;
};

/**
 * Get all assistants for the active organization
 */
export const getAssistants = async (organizationId?: string): Promise<Assistant[]> => {
  try {
    // Get active organization ID from context if not provided
    const orgId = organizationId || getActiveOrganizationId();
    
    if (!orgId) {
      console.error('[getAssistants] No active organization found in any source');
      console.error('[getAssistants] LocalStorage contains:', localStorage.getItem('activeOrganizationId'));
      console.error('[getAssistants] SessionStorage contains:', sessionStorage.getItem('activeOrganizationId'));
      throw new Error('No active organization found. Please select an organization first.');
    }
    
    try {
      console.log(`[getAssistants] Fetching assistants for organization: ${orgId}`);
      
      // Add extra debugging to trace the exact headers being sent
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      console.log('[getAssistants] Headers that will be sent:', {
        'Authorization': `Bearer ${token.substring(0, 10)}...`, // Only log part of the token for security
        'X-Organization-ID': orgId,
      });
      
      const assistants = await fetchAPI(`/assistants?organizationId=${orgId}`);
      console.log(`[getAssistants] Successfully fetched ${assistants.length} assistants`);
      return assistants.map(transformAssistant) || [];
    } catch (error: any) {
      // If the error indicates the user doesn't have access to the organization,
      // this likely means there's a mismatch between the stored organization ID
      // and what the user actually has access to
      if (error.message && error.message.includes('User does not have access to this organization')) {
        console.error(`[getAssistants] Access denied to organization ${orgId}. User likely doesn't have membership.`);
        // Clear the stored organization ID as it's invalid for this user
        try {
          localStorage.removeItem('activeOrganizationId');
          sessionStorage.removeItem('activeOrganizationId');
          console.log('[getAssistants] Cleared invalid organization ID from storage');
        } catch (storageError) {
          console.error('[getAssistants] Failed to clear storage:', storageError);
        }
        
        // Return empty array with a more helpful error
        throw new Error('You do not have access to this organization. Please select a different organization.');
      }
      
      // If the endpoint doesn't exist or returns 404, return empty array (normal for new app)
      if (shouldUseMockData(error)) {
        return MOCK_ASSISTANTS;
      }
      
      // For other errors, re-throw
      throw error;
    }
  } catch (error) {
    console.error('Error fetching assistants:', error);
    throw error;
  }
};

/**
 * Get a specific assistant by ID
 */
export const getAssistant = async (assistantId: string): Promise<Assistant> => {
  try {
    try {
      const assistant = await fetchAPI(`/assistants/${assistantId}`);
      return transformAssistant(assistant);
    } catch (error: any) {
      // If the endpoint doesn't exist, return mock data
      if (shouldUseMockData(error)) {
        const mockAssistant = MOCK_ASSISTANTS.find(a => a.id === assistantId);
        if (mockAssistant) return mockAssistant;
      }
      // Re-throw if not a mock-able error or assistant not found
      throw error;
    }
  } catch (error) {
    console.error(`Error fetching assistant ${assistantId}:`, error);
    throw error;
  }
};

/**
 * Create a new assistant
 */
export const createAssistant = async (params: CreateAssistantParams): Promise<Assistant> => {
  try {
    // Get active organization ID
    const organizationId = getActiveOrganizationId();
    
    if (!organizationId) {
      throw new Error('No active organization found');
    }
    
    try {
      // Create assistant with organization ID
      const assistant = await fetchAPI('/assistants', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          organizationId
        })
      });
      
      return transformAssistant(assistant);
    } catch (error: any) {
      // If the endpoint doesn't exist, create mock data
      if (shouldUseMockData(error)) {
        const mockId = `mock-${Date.now()}`;
        const newAssistant: Assistant = {
          id: mockId,
          name: params.name,
          firstMessage: params.description || "[placeholder, replace with actual first message]::Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?",
          voicemailMessage: params.systemPrompt || "{# Appointment Scheduling Agent Prompt\n\n## Identity & Purpose\n\nYou are Riley, an appointment scheduling voice assistant for Wellness Partners, a multi-specialty health clinic. Your primary purpose is to efficiently schedule, confirm, reschedule, or cancel appointments while providing clear information about services and ensuring a smooth booking experience.",
          knowledgeBaseId: params.knowledgeBaseId,
          model: params.templateId ? { template: params.templateId } : undefined,
          organizationId,
          hipaaEnabled: false,
          backgroundDenoisingEnabled: false,
          endCallPhrases: [],
          serverMessages: [],
          clientMessages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Add to mock data
        MOCK_ASSISTANTS.push(newAssistant);
        return newAssistant;
      }
      
      // Re-throw if not a mock-able error
      throw error;
    }
  } catch (error) {
    console.error('Error creating assistant:', error);
    throw error;
  }
};

/**
 * Update an existing assistant
 */
export const updateAssistant = async (
  assistantId: string, 
  params: UpdateAssistantParams
): Promise<Assistant> => {
  try {
    try {
      const assistant = await fetchAPI(`/assistants/${assistantId}`, {
        method: 'PATCH',
        body: JSON.stringify(params)
      });
      
      return transformAssistant(assistant);
    } catch (error: any) {
      // If the endpoint doesn't exist, update mock data
      if (shouldUseMockData(error)) {
        const index = MOCK_ASSISTANTS.findIndex(a => a.id === assistantId);
        if (index >= 0) {
          const updated = {
            ...MOCK_ASSISTANTS[index],
            ...params,
            // Map fields to match schema
            ...(params.description && { firstMessage: params.description }),
            ...(params.systemPrompt && { voicemailMessage: params.systemPrompt }),
            ...(params.config && { model: params.config }),
            updatedAt: new Date().toISOString()
          };
          
          MOCK_ASSISTANTS[index] = updated;
          return updated;
        }
      }
      
      // Re-throw if not a mock-able error or assistant not found
      throw error;
    }
  } catch (error) {
    console.error(`Error updating assistant ${assistantId}:`, error);
    throw error;
  }
};

/**
 * Delete an assistant
 */
export const deleteAssistant = async (assistantId: string): Promise<void> => {
  try {
    try {
      await fetchAPI(`/assistants/${assistantId}`, {
        method: 'DELETE'
      });
    } catch (error: any) {
      // If the endpoint doesn't exist, remove from mock data
      if (shouldUseMockData(error)) {
        const index = MOCK_ASSISTANTS.findIndex(a => a.id === assistantId);
        if (index >= 0) {
          MOCK_ASSISTANTS.splice(index, 1);
          return;
        }
      }
      
      // Re-throw if not a mock-able error or assistant not found
      throw error;
    }
  } catch (error) {
    console.error(`Error deleting assistant ${assistantId}:`, error);
    throw error;
  }
};

/**
 * Toggle assistant HIPAA compliance
 */
export const toggleAssistantHipaa = async (
  assistantId: string, 
  hipaaEnabled: boolean
): Promise<Assistant> => {
  return updateAssistant(assistantId, { hipaaEnabled });
};

/**
 * Link a knowledge base to an assistant
 */
export const linkKnowledgeBaseToAssistant = async (
  assistantId: string,
  knowledgeBaseId: string
): Promise<Assistant> => {
  try {
    try {
      console.log(`[linkKnowledgeBaseToAssistant] Linking KB ${knowledgeBaseId} to assistant ${assistantId}`);
      
      const orgId = getActiveOrganizationId();
      if (!orgId) {
        throw new Error('No active organization ID found');
      }
      
      const response = await fetchAPI(`/v1/knowledge-bases/link-to-assistant`, {
        method: 'POST',
        body: JSON.stringify({
          assistantId,
          knowledgeBaseId,
          organizationId: orgId
        })
      });
      
      if (response.success && response.assistant) {
        console.log('[linkKnowledgeBaseToAssistant] Response:', response);
        return transformAssistant(response.assistant);
      }
      
      throw new Error(response.error || 'Failed to link knowledge base to assistant');
    } catch (error: any) {
      // If the endpoint doesn't exist, try direct update of the assistant
      if (shouldUseMockData(error)) {
        console.log('[linkKnowledgeBaseToAssistant] API failed, trying to update assistant directly');
        
        // Try updating the assistant directly
        try {
          return await updateAssistant(assistantId, { knowledgeBaseId });
        } catch (updateError) {
          console.error('[linkKnowledgeBaseToAssistant] Direct update failed:', updateError);
          
          // Update local mock as last resort
          const index = MOCK_ASSISTANTS.findIndex(a => a.id === assistantId);
          if (index >= 0) {
            MOCK_ASSISTANTS[index].knowledgeBaseId = knowledgeBaseId;
            MOCK_ASSISTANTS[index].updatedAt = new Date().toISOString();
            return MOCK_ASSISTANTS[index];
          }
        }
      }
      
      // Re-throw if not a mock-able error or assistant not found
      throw error;
    }
  } catch (error) {
    console.error(`Error linking knowledge base to assistant:`, error);
    throw error;
  }
};

/**
 * Remove a knowledge base from an assistant
 */
export const removeKnowledgeBaseFromAssistant = async (
  assistantId: string
): Promise<Assistant> => {
  return updateAssistant(assistantId, { knowledgeBaseId: null });
};

/**
 * Custom hook to get assistants with organization context
 */
export const useAssistants = () => {
  const { activeOrganization, loading: orgLoading } = useOrganization();
  
  // Instead of providing functions that users call later, 
  // this hook now provides direct access to the organization context
  return {
    // Data
    organizationId: activeOrganization?.id,
    organizationName: activeOrganization?.name,
    organizationLoading: orgLoading,
    
    // Functions that use the current active organization from context
    getAssistants: () => {
      if (!activeOrganization?.id) {
        console.warn('[useAssistants] No active organization available');
        return Promise.resolve([]);
      }
      return getAssistants(activeOrganization.id);
    },
    
    createAssistant: (params: CreateAssistantParams) => {
      if (!activeOrganization?.id) {
        return Promise.reject(new Error('No active organization selected'));
      }
      // The organizationId is already handled in the createAssistant function
      return createAssistant(params);
    },
    
    getAssistant: (assistantId: string) => getAssistant(assistantId),
    updateAssistant: (assistantId: string, params: UpdateAssistantParams) => updateAssistant(assistantId, params),
    deleteAssistant: (assistantId: string) => deleteAssistant(assistantId),
    toggleAssistantHipaa: (assistantId: string, hipaaEnabled: boolean) => toggleAssistantHipaa(assistantId, hipaaEnabled),
    linkKnowledgeBaseToAssistant: (assistantId: string, knowledgeBaseId: string) => linkKnowledgeBaseToAssistant(assistantId, knowledgeBaseId),
    removeKnowledgeBaseFromAssistant: (assistantId: string) => removeKnowledgeBaseFromAssistant(assistantId)
  };
};
