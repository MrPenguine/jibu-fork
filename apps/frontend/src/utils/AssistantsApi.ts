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
  voice?: {
    provider?: string;
    voiceId?: string;
    name?: string;
    model?: string;
    stability?: number;
    similarityBoost?: number;
    speakerBoost?: boolean;
    autoMode?: boolean;
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
  voice?: any; // Voice settings for TTS
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
    console.log(`[getAssistant] Fetching assistant with ID: ${assistantId}`);
    
    // Get active organization ID for logging purposes
    const orgId = getActiveOrganizationId();
    console.log(`[getAssistant] Current organization ID: ${orgId || 'none'}`);
    
    try {
      // Add extra debugging to trace the exact headers being sent
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('[getAssistant] No authentication token available');
        throw new Error('No authentication token available');
      }
      
      console.log(`[getAssistant] Making API call to /assistants/${assistantId}`);
      const assistant = await fetchAPI(`/assistants/${assistantId}`);
      
      if (!assistant || !assistant.id) {
        console.error('[getAssistant] Received invalid assistant data:', assistant);
        throw new Error('Received invalid assistant data from API');
      }
      
      console.log(`[getAssistant] Successfully fetched assistant:`, assistant);
      return transformAssistant(assistant);
    } catch (error: any) {
      console.error(`[getAssistant] Error in API call:`, error);
      
      // If the endpoint doesn't exist, return mock data
      if (shouldUseMockData(error)) {
        console.warn(`[getAssistant] Using mock data for assistant ${assistantId}`);
        const mockAssistant = MOCK_ASSISTANTS.find(a => a.id === assistantId);
        if (mockAssistant) {
          console.log(`[getAssistant] Found mock assistant:`, mockAssistant);
          return mockAssistant;
        }
        
        // Create a new mock assistant if not found
        console.log(`[getAssistant] Creating new mock assistant with ID ${assistantId}`);
        const newMockAssistant: Assistant = {
          id: assistantId,
          name: `Assistant ${assistantId.substring(0, 5)}`,
          organizationId: getActiveOrganizationId() || 'mock-org',
          firstMessage: 'Hello! How can I help you today?',
          voicemailMessage: 'I am a helpful assistant.',
          model: { provider: 'openai', model: 'gpt-4-turbo' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Add to mock assistants array for future reference
        MOCK_ASSISTANTS.push(newMockAssistant);
        return newMockAssistant;
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
 * Interface for pricing information
 */
export interface ModelPricing {
  inputPrice?: number;
  outputPrice?: number;
  imagePrice?: number;
  unit?: string;
}

/**
 * Interface for model data
 */
export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  description: string;
  speedTier?: string;
  pricing?: ModelPricing;
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
  xai?: ModelInfo[];
  other?: ModelInfo[];
}

// Cache variables
let modelCache: CategorizedModels | null = null;
let modelCacheTimestamp: number = 0;
const MODEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Fetch available models - now manually listing Grok and Gemini models
 */
export const getAvailableModels = async (): Promise<CategorizedModels> => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (modelCache && (now - modelCacheTimestamp < MODEL_CACHE_TTL)) {
    console.log('[getAvailableModels] Returning models from memory cache');
    return modelCache;
  }
  
  // Instead of fetching from API, we now manually define the models
  console.log('[getAvailableModels] Using manually defined models');
  
  // Define the models with their pricing and token information
  const models: CategorizedModels = {
    // XAI (Grok) models
    xai: [
      { 
        id: 'x-ai/grok-3-latest', 
        name: 'Grok 3', 
        contextLength: 131072, 
        description: 'Text Input: $3.00, Text Completion: $15.00', 
        speedTier: 'balanced',
        pricing: {
          inputPrice: 3.00,
          outputPrice: 15.00,
          unit: 'per million tokens'
        }
      },
      { 
        id: 'x-ai/grok-3-fast-latest', 
        name: 'Grok 3 Fast', 
        contextLength: 131072, 
        description: 'Text Input: $5.00, Text Completion: $25.00', 
        speedTier: 'fastest',
        pricing: {
          inputPrice: 5.00,
          outputPrice: 25.00,
          unit: 'per million tokens'
        }
      },
      { 
        id: 'x-ai/grok-3-mini-latest', 
        name: 'Grok 3 Mini', 
        contextLength: 131072, 
        description: 'Text Input: $0.30, Text Completion: $0.50', 
        speedTier: 'balanced',
        pricing: {
          inputPrice: 0.30,
          outputPrice: 0.50,
          unit: 'per million tokens'
        }
      },
      { 
        id: 'x-ai/grok-3-mini-fast-latest', 
        name: 'Grok 3 Mini Fast', 
        contextLength: 131072, 
        description: 'Text Input: $0.60, Text Completion: $4.00', 
        speedTier: 'fastest',
        pricing: {
          inputPrice: 0.60,
          outputPrice: 4.00,
          unit: 'per million tokens'
        }
      },
      { 
        id: 'x-ai/grok-2-vision-latest', 
        name: 'Grok 2 Vision', 
        contextLength: 8192, 
        description: 'Text Input: $2.00, Image Input: $2.00, Text Completion: $10.00', 
        speedTier: 'balanced',
        pricing: {
          inputPrice: 2.00,
          imagePrice: 2.00,
          outputPrice: 10.00,
          unit: 'per million tokens'
        }
      }
    ],
    
    // Google (Gemini) models - text only models - using exact IDs from the UI
    google: [
      { 
        id: 'gemini-1.5-pro', 
        name: 'Gemini 1.5 Pro', 
        contextLength: 2097152, 
        description: 'Complex reasoning tasks requiring more intelligence. Input: 2M tokens, Output: 8K tokens', 
        speedTier: 'capable'
      },
      { 
        id: 'gemini-2.0-flash', 
        name: 'Gemini 2.0 Flash', 
        contextLength: 1048576, 
        description: 'Next generation features, speed. Input: 1M tokens, Output: 8K tokens', 
        speedTier: 'fastest'
      },
      { 
        id: 'gemini-2.0-flash-lite', 
        name: 'Gemini 2.0 Flash Lite', 
        contextLength: 1048576, 
        description: 'Cost efficiency and low latency. Input: 1M tokens, Output: 8K tokens', 
        speedTier: 'fastest'
      }
    ],
    
    // Mistral models
    mistralai: [
      { 
        id: 'mistral-large-latest', 
        name: 'Mistral Large', 
        contextLength: 131072, 
        description: 'Top-tier reasoning model for high-complexity tasks. Input: 128K tokens, Output: 8K tokens', 
        speedTier: 'capable'
      },
      { 
        id: 'mistral-medium-latest', 
        name: 'Mistral Medium 3', 
        contextLength: 131072, 
        description: 'Frontier-class multimodal model. Input: 128K tokens, Output: 8K tokens', 
        speedTier: 'capable'
      },
      { 
        id: 'mistral-small-latest', 
        name: 'Mistral Small', 
        contextLength: 131072, 
        description: 'Leader in small models with image understanding capabilities. Input: 128K tokens, Output: 8K tokens', 
        speedTier: 'fastest'
      },
      { 
        id: 'codestral-latest', 
        name: 'Codestral', 
        contextLength: 262144, 
        description: 'Cutting-edge language model for coding. Input: 256K tokens, Output: 8K tokens', 
        speedTier: 'fastest'
      },
      { 
        id: 'ministral-3b-latest', 
        name: 'Ministral 3B', 
        contextLength: 131072, 
        description: 'World\'s best edge model. Input: 128K tokens, Output: 8K tokens', 
        speedTier: 'fastest'
      }
    ]
  };
  
  // Save to cache
  modelCache = models;
  modelCacheTimestamp = now;
  
  return models;
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
