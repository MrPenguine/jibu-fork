import { fetchAPI, getActiveOrganizationId } from './api';
import { useOrganization } from './organizationContext';
import { createClient } from './supabase/client';

export interface Assistant {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  knowledgeBaseId?: string | null;
  firstMessage?: string;
  voicemailMessage?: string; // System prompt
  model?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    preference?: 'latency' | 'balance' | 'capability';
    [key: string]: any;
  };
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
  model?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    preference?: 'latency' | 'balance' | 'capability';
  };
}

interface UpdateAssistantParams {
  name?: string;
  description?: string; // Maps to firstMessage
  systemPrompt?: string; // Maps to voicemailMessage
  knowledgeBaseId?: string | null;
  hipaaEnabled?: boolean;
  model?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    preference?: 'latency' | 'balance' | 'capability';
  };
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
      console.log('[createAssistant] Creating assistant with params:', JSON.stringify(params, null, 2));
      
      // Create request payload, converting any old format data to new format
      const payload = {
        ...params,
        organizationId,
        // If templateId is provided but not model, include it as model config
        ...(params.templateId && !params.model && {
          model: {
            model: params.templateId
          }
        })
      };
      
      console.log('[createAssistant] Sending payload:', JSON.stringify(payload, null, 2));
      
      // Create assistant with organization ID
      const assistant = await fetchAPI('/assistants', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      console.log('[createAssistant] Response:', assistant);
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
          model: params.model ? { ...params.model } : undefined,
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
      // Convert any legacy config format to the proper model format
      let updatedParams = { ...params };
      
      // If there's an old format "config" in the params, map it to the new model format
      if ('config' in (params as any) && (params as any).config) {
        console.log('[updateAssistant] Converting legacy config format to model format:', (params as any).config);
        updatedParams.model = {
          ...(typeof (params as any).config === 'object' ? (params as any).config : {}),
          ...(updatedParams.model || {})
        };
        // Use delete on the updatedParams which is a copy
        delete (updatedParams as any).config;
      }
      
      // Ensure model is properly structured if it exists
      if (updatedParams.model) {
        // Make sure model fields use proper keys
        const { provider, model, temperature, maxTokens, preference } = updatedParams.model;
        updatedParams.model = {
          provider,
          model,
          temperature,
          maxTokens,
          preference
        };
        
        // Filter out undefined values
        Object.keys(updatedParams.model).forEach(key => {
          if (updatedParams.model && updatedParams.model[key as keyof typeof updatedParams.model] === undefined) {
            delete updatedParams.model[key as keyof typeof updatedParams.model];
          }
        });
      }
      
      console.log('[updateAssistant] Sending update with params:', JSON.stringify(updatedParams, null, 2));
      
      const assistant = await fetchAPI(`/assistants/${assistantId}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedParams)
      });
      
      console.log('[updateAssistant] Response:', assistant);
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
            ...(params.model && { model: params.model }),
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
 * Interface for model data
 */
export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  description: string;
  speedTier?: string;
}

/**
 * Interface for categorized models
 */
export interface CategorizedModels {
  openai?: ModelInfo[];
  google?: ModelInfo[];
  anthropic?: ModelInfo[];
  mistralai?: ModelInfo[];
  groq?: ModelInfo[];
  meta?: ModelInfo[];
  cohere?: ModelInfo[];
  other?: ModelInfo[];
}

// Cache variables
let modelCache: CategorizedModels | null = null;
let modelCacheTimestamp: number = 0;
const MODEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Fetch available models from OpenRouter API
 */
export const getAvailableModels = async (): Promise<CategorizedModels> => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (modelCache && (now - modelCacheTimestamp < MODEL_CACHE_TTL)) {
    console.log('[getAvailableModels] Returning models from memory cache');
    return modelCache;
  }
  
  try {
    console.log('[getAvailableModels] Fetching models from backend API');
    
    // Set a timeout for the fetch request
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 5s')), 5000);
    });
    
    // Make the actual fetch request through our API utility
    const fetchPromise = fetchAPI('/assistants/models');
    
    // Race the fetch against the timeout
    const models = await Promise.race([fetchPromise, timeoutPromise]) as CategorizedModels;
    
    console.log('[getAvailableModels] Successfully fetched models');
    
    // Save to cache
    modelCache = models;
    modelCacheTimestamp = now;
    
    return models;
  } catch (error: any) {
    console.error('[getAvailableModels] Error fetching models:', error);
    
    // If we have a stale cache, use it despite being expired
    if (modelCache) {
      console.log('[getAvailableModels] Using stale cache as fallback');
      return modelCache;
    }
    
    // If the endpoint doesn't exist, return mock data
    if (shouldUseMockData(error)) {
      console.log('[getAvailableModels] Using mock data for models');
      const mockData = {
        openai: [
          { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o Mini', contextLength: 128000, description: 'Fastest OpenAI model with good capabilities', speedTier: 'fastest' },
          { id: 'openai/gpt-3.5-turbo', name: 'OpenAI: GPT-3.5 Turbo', contextLength: 16000, description: 'Fast, efficient model for most tasks', speedTier: 'balanced' },
          { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o', contextLength: 128000, description: 'Strong reasoning capabilities with good speed', speedTier: 'balanced' }
        ],
        google: [
          { id: 'google/gemini-flash-1.5', name: 'Google: Gemini Flash 1.5', contextLength: 32000, description: 'Google\'s fastest model for real-time interactions', speedTier: 'fastest' },
          { id: 'google/gemini-pro-1.5', name: 'Google: Gemini Pro 1.5', contextLength: 128000, description: 'Balanced model with strong reasoning', speedTier: 'balanced' }
        ],
        anthropic: [
          { id: 'anthropic/claude-3-haiku', name: 'Anthropic: Claude 3 Haiku', contextLength: 200000, description: 'Anthropic\'s fastest model for real-time interactions', speedTier: 'fastest' },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', contextLength: 200000, description: 'Great balance of speed and capability', speedTier: 'balanced' }
        ],
        mistralai: [
          { id: 'mistralai/mistral-small', name: 'Mistral AI: Mistral Small', contextLength: 32000, description: 'Mistral\'s efficient model for real-time applications', speedTier: 'fastest' },
          { id: 'mistralai/mistral-large', name: 'Mistral AI: Mistral Large', contextLength: 32000, description: 'Mistral\'s most capable model', speedTier: 'balanced' }
        ],
        groq: [
          { id: 'groq/llama3-8b-8192', name: 'Groq: Llama-3 8B', contextLength: 8192, description: 'Ultra-fast inference with Llama 3 on Groq LPUs', speedTier: 'fastest' },
          { id: 'groq/llama3-70b-8192', name: 'Groq: Llama-3 70B', contextLength: 8192, description: 'High capability with impressive speed on Groq', speedTier: 'balanced' }
        ],
        meta: [
          { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Meta: Llama 3.1 8B', contextLength: 8192, description: 'Fast and efficient open model', speedTier: 'fastest' }
        ],
        cohere: [
          { id: 'cohere/command-r', name: 'Cohere: Command R', contextLength: 128000, description: 'Balanced model for reasoning tasks', speedTier: 'balanced' }
        ]
      };
      
      // Save mock data to cache
      modelCache = mockData;
      modelCacheTimestamp = now;
      
      return mockData;
    }
    
    // Return a friendlier error message with guidance
    const errorMessage = error.message || 'Unknown error';
    console.error(`[getAvailableModels] Error details: ${errorMessage}`);
    
    // Throw a more informative error
    throw new Error(`Could not load available models. Please check your internet connection and try again. (${errorMessage})`);
  }
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
    
    getAvailableModels: () => getAvailableModels(),
    
    getAssistant: (assistantId: string) => getAssistant(assistantId),
    updateAssistant: (assistantId: string, params: UpdateAssistantParams) => updateAssistant(assistantId, params),
    deleteAssistant: (assistantId: string) => deleteAssistant(assistantId),
    toggleAssistantHipaa: (assistantId: string, hipaaEnabled: boolean) => toggleAssistantHipaa(assistantId, hipaaEnabled),
    linkKnowledgeBaseToAssistant: (assistantId: string, knowledgeBaseId: string) => linkKnowledgeBaseToAssistant(assistantId, knowledgeBaseId),
    removeKnowledgeBaseFromAssistant: (assistantId: string) => removeKnowledgeBaseFromAssistant(assistantId)
  };
};
