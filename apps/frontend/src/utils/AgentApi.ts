import { fetchAPI } from './api';

/**
 * Utility for making requests to the Agent API
 */

export interface AgentRequestConfig {
  assistantId: string;
  clientId?: string;
  knowledgeBaseId?: string;
  stream?: boolean;
}

export interface AgentRequest {
  input: string;
  inputType?: string;
  outputType?: string;
  sessionId?: string;
  config?: AgentRequestConfig;
}

export interface AgentResponse {
  output: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

/**
 * Extract text message from complex agent response
 */
export function extractMessageFromResponse(response: any): string {
  // If response is already a string, return it
  if (typeof response === 'string') {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      
      // Check for nested output formats
      if (parsed.outputs && Array.isArray(parsed.outputs) && parsed.outputs.length > 0) {
        const firstOutput = parsed.outputs[0];
        
        // Use a recursive path traversal to find text content
        const findTextContent = (obj: any, maxDepth = 3, currentDepth = 0): string | null => {
          if (currentDepth > maxDepth || !obj || typeof obj !== 'object') return null;
          
          // Check common text content fields
          if (obj.text && typeof obj.text === 'string') return obj.text;
          if (obj.content && typeof obj.content === 'string') return obj.content;
          if (obj.message && typeof obj.message === 'string') return obj.message;
          if (obj.answer && typeof obj.answer === 'string') return obj.answer;
          
          // Recursively check nested objects and arrays
          for (const key in obj) {
            const result = findTextContent(obj[key], maxDepth, currentDepth + 1);
            if (result) return result;
          }
          
          return null;
        };
        
        const textContent = findTextContent(firstOutput);
        if (textContent) return textContent;
      }
      
      // Check for direct message property
      if (parsed.message) {
        return parsed.message;
      }
      
      if (parsed.output && typeof parsed.output === 'string') {
        // Try recursively parsing the output
        return extractMessageFromResponse(parsed.output);
      }
      
      // Fallback to original string
      return response;
    } catch (e) {
      // Not JSON, just return the string
      return response;
    }
  }
  
  // Handle object responses
  if (response && typeof response === 'object') {
    // Check different possible paths for the message
    if (response.text) return response.text;
    if (response.content) return response.content;
    if (response.message && typeof response.message === 'string') return response.message;
    if (response.output && typeof response.output === 'string') {
      return extractMessageFromResponse(response.output);
    }
    
    // Last resort - stringify but warn about it
    console.warn('Could not extract message from object response:', response);
    return JSON.stringify(response);
  }
  
  return String(response);
}

/**
 * Check the health of the agent service
 */
export async function checkAgentHealth(): Promise<{ status: string; connected: boolean }> {
  try {
    // Use fetchAPI instead of direct fetch
    return await fetchAPI('/v1/agent/health', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Error checking agent health:', error);
    return { status: 'error', connected: false };
  }
}

/**
 * Send a request to the agent API
 */
export async function sendAgentRequest(
  request: AgentRequest
): Promise<AgentResponse> {
  // Use fetchAPI instead of direct fetch
  return await fetchAPI('/v1/agent/query', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

/**
 * Callbacks for streaming agent responses
 */
export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string, eventData: any) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Options for streaming requests
 */
export interface StreamOptions extends StreamCallbacks {
  headers?: Record<string, string>;
}

/**
 * Send a streaming request to the agent API
 * Returns a fetch response that can be used with a streaming reader
 */
export async function sendStreamingAgentRequest(
  request: AgentRequest,
  options?: StreamOptions
): Promise<Response | void> {
  try {
    if (options?.onStart) {
      options.onStart();
    }
    
    // Use fetchAPI for authentication but still need direct fetch for streaming
    // Get auth headers from fetchAPI's internal implementation
    const supabase = await import('./supabase/client').then(m => m.createClient());
    const { data: { session } } = await supabase.auth.getSession();
    const activeOrgId = await import('./fileApi').then(m => m.getActiveOrgId());
    
    if (!session?.access_token) {
      throw new Error('No active session. User must be authenticated to make this request.');
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...(activeOrgId ? { 'X-Organization-ID': activeOrgId } : {}),
      ...(options?.headers || {})
    };
    
    // Get the API base URL from the api.ts module
    const { API_BASE_URL } = await import('./api');
    const url = `${API_BASE_URL}/v1/agent/stream`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Server responded with ${response.status}: ${errorText}`);
      if (options?.onError) {
        options.onError(error);
      }
      return response; // Still return the response for backward compatibility
    }
    
    // Check if we have a streaming response
    if (!response.body) {
      const error = new Error('No response body from server');
      if (options?.onError) {
        options.onError(error);
      }
      return response;
    }
    
    // If we have callbacks, process the stream
    if (options) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      // Process the stream
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the chunk and split by double newlines (SSE format)
          const chunk = decoder.decode(value, { stream: true });
          
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.substring(6));
                
                // Handle error responses
                if (eventData.error) {
                  throw new Error(eventData.message || 'Unknown error');
                }
                
                // Only process output if it's not empty and it's not a duplicate of the first message
                if (eventData.output) {
                  // Check if this is a duplicate of the first message (common greeting pattern)
                  const isFirstMessageDuplicate = fullResponse && 
                    eventData.output.includes("Thank you for calling Wellness Partners") && 
                    eventData.output.includes("How may I help you today?");
                  
                  // Only process if it's not a duplicate greeting
                  if (!isFirstMessageDuplicate) {
                    // Call the onToken callback
                    if (options.onToken) {
                      options.onToken(eventData.output, eventData);
                    }
                    
                    // Update the full response with non-empty content
                    fullResponse = eventData.output;
                  }
                }
                
                // If this is the final response with metadata, call onComplete
                if (eventData.metadata?.type === 'final' && options.onComplete) {
                  options.onComplete(fullResponse);
                }
              } catch (error) {
                console.error('Error parsing SSE message:', error);
                if (options.onError) {
                  options.onError(error instanceof Error ? error : new Error(String(error)));
                }
              }
            }
          }
        }
        
        // onComplete is already called when we receive the final metadata
        // No need to call it again here
      } catch (error) {
        console.error('Error reading stream:', error);
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      return;
    }
    
    // If no callbacks, just return the response for manual handling
    return response;
  } catch (error) {
    console.error('Error sending streaming request:', error);
    if (options?.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
