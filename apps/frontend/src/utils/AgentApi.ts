import { fetchAPI } from './api';

export interface AgentConfig {
  assistantId?: string;
  clientId?: string;
  knowledgeBaseId?: string;
  stream?: boolean;
}

export interface AgentRequest {
  input: string;
  inputType?: 'chat' | 'text';
  outputType?: 'chat' | 'text';
  sessionId?: string;
  config: AgentConfig;
}

export interface AgentResponse {
  output: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Process a query through the agent
 */
export const processAgentQuery = async (request: AgentRequest): Promise<AgentResponse> => {
  try {
    const response = await fetchAPI('/v1/agent/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    return response;
  } catch (error) {
    console.error('Error processing agent query:', error);
    throw error;
  }
};

/**
 * Process a streaming query through the agent
 * Returns an EventSource for SSE streaming
 */
export const processStreamingAgentQuery = (request: AgentRequest): EventSource => {
  // Get the JWT token from localStorage
  const token = localStorage.getItem('supabase.auth.token');
  
  // Create a URL with the request data as query parameters
  const url = new URL('/api/v1/agent/stream', window.location.origin);
  url.searchParams.append('request', JSON.stringify(request));
  
  // Create an EventSource with the JWT token in the headers
  const eventSource = new EventSource(url.toString(), {
    withCredentials: true,
  });
  
  return eventSource;
};

/**
 * Check the health of the agent service
 */
export const checkAgentHealth = async (): Promise<{ status: string; connected: boolean }> => {
  try {
    const response = await fetchAPI('/v1/agent/health', {
      method: 'POST',
    });
    
    return response;
  } catch (error) {
    console.error('Error checking agent health:', error);
    return { status: 'error', connected: false };
  }
};
