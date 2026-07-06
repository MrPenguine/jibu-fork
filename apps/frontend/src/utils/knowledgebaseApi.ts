import { createClient } from './supabase/client';
import { getActiveWorkspaceId } from './fileApi';
import { fetchAPI, API_BASE_URL } from './api';

// Import workspace context for types only
import { useWorkspace } from './workspaceContext';

// Knowledge base types
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
}

export async function listFoldersForKb(knowledgeBaseId: string, specificWorkspaceId?: string): Promise<{ id: string; name: string }[]> {
  try {
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    if (!workspaceId) {
      return [];
    }
    const headers = await getAuthHeaders(workspaceId);
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/folders`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export async function createFolderForKb(knowledgeBaseId: string, name: string, specificWorkspaceId?: string): Promise<{ id: string; name: string; workspaceId: string } | null> {
  try {
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    if (!workspaceId) {
      return null;
    }
    const headers = await getAuthHeaders(workspaceId);
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/folders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (e) {
    return null;
  }
}

export async function deleteFolderForKb(knowledgeBaseId: string, folderId: string, specificWorkspaceId?: string): Promise<boolean> {
  try {
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    if (!workspaceId) {
      return false;
    }
    const headers = await getAuthHeaders(workspaceId);
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/folders/${folderId}`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch (e) {
    console.error('Error deleting folder:', e);
    return false;
  }
}

export async function deleteSourceFromKb(knowledgeBaseId: string, sourceId: string, specificWorkspaceId?: string): Promise<boolean> {
  try {
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    if (!workspaceId) {
      return false;
    }
    const headers = await getAuthHeaders(workspaceId);
    // Note: The backend endpoint is /v1/knowledge-bases/sources/:sourceId (without kbId in path)
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/sources/${sourceId}`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch (e) {
    console.error('Error deleting source:', e);
    return false;
  }
}

export interface KnowledgeBaseSource {
  id: string;
  sourceId: string;
  sourcePointer: string;
  knowledgeBaseId: string;
  sourceType: string;
  indexingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'INDEXED' | 'FAILED'; 
  createdAt: string;
  updatedAt: string;
}

// Wrapper around getActiveWorkspaceId for better logging
export function getCurrentWorkspaceId(specificWorkspaceId?: string): string | null {
  // Prioritize the specificWorkspaceId if provided (could be from the assistant or props)
  if (specificWorkspaceId) {
        console.log(`[getCurrentWorkspaceId] Using provided specific workspace ID: ${specificWorkspaceId}`);
    return specificWorkspaceId;
  }
  
  // Try to get organization ID from local storage or other sources
  const workspaceId = getActiveWorkspaceId();
  
  // Add extra logging for debugging purposes
  if (workspaceId) {
        console.log(`[getCurrentWorkspaceId] Using workspace ID from active context: ${workspaceId}`);
  } else {
        console.warn('[getCurrentWorkspaceId] No workspace ID available from any source');
  }
  
  return workspaceId;
}

// Get authorization headers with token and workspace ID
async function getAuthHeaders(workspaceId: string) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Workspace-ID': workspaceId,
    'workspace-id': workspaceId, // Some endpoints might expect this format
        'X-Force-Workspace-ID': workspaceId, // Extra header for debugging/clarity
  };
}

/**
 * List all knowledge bases for the current workspace
 * @param specificWorkspaceId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function listKnowledgeBases(specificWorkspaceId?: string): Promise<KnowledgeBase[]> {
  try {
    // Use the provided specificWorkspaceId or get from getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
            console.warn('[listKnowledgeBases] No workspace ID available, results may be limited');
    } else {
            console.log(`[listKnowledgeBases] Using workspace ID in headers: ${workspaceId}`);
    }
    
    // Get auth headers with the workspace ID
    const headers = await getAuthHeaders(workspaceId || '');
    
    // Call the backend API directly, workspace ID is passed in headers
    console.log(`[listKnowledgeBases] Requesting knowledge bases with workspace headers:`, 
      Object.entries(headers)
        .filter(([key]) => key.toLowerCase().includes('workspace'))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {} as Record<string, string>));
    
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[listKnowledgeBases] API error ${response.status}: ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      const knowledgeBases = data;
            console.log(`[listKnowledgeBases] Found ${knowledgeBases.length} knowledge bases for workspace ${workspaceId || 'unknown'}`);
      
      if (knowledgeBases.length > 0) {
        // Log workspace distribution for debugging
        const workspaceCounts = knowledgeBases.reduce((acc, kb) => {
          const workspaceId = kb.workspaceId || 'unknown';
          acc[workspaceId] = (acc[workspaceId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
                console.log(`[listKnowledgeBases] Knowledge bases by workspace:`, workspaceCounts);
      }
      
      return knowledgeBases;
    }
    
    console.log('[listKnowledgeBases] Invalid response format:', data);
    return [];
  } catch (error) {
    console.error('[listKnowledgeBases] Error listing knowledge bases:', error);
    // Return empty array in case of error
    return [];
  }
}

/**
 * Update an existing knowledge base (rename or change description)
 */
export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  payload: { name?: string; description?: string },
  specificWorkspaceId?: string
): Promise<KnowledgeBase | null> {
  try {
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    const headers = await getAuthHeaders(workspaceId || '');
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error('Error updating knowledge base:', e);
    return null;
  }
}

/**
 * Create a new knowledge base
 * @param name The name of the knowledge base
 * @param specificWorkspaceId Optional: Provide a specific workspace ID, otherwise uses active workspace
 */
export async function createKnowledgeBase(name: string, specificWorkspaceId?: string): Promise<KnowledgeBase> {
  try {
    // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
            const error = new Error('[createKnowledgeBase] No workspace ID available');
      console.error(error);
      throw error;
    }
    
        console.log(`[createKnowledgeBase] Creating knowledge base "${name}" for workspace: ${workspaceId}`);
    
    // Get auth headers with the workspace ID
    const headers = await getAuthHeaders(workspaceId);
    
    // Call the backend API directly with the workspace ID explicitly in the body
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        workspaceId
      })
    });
    
    if (!response.ok) {
      let errorMessage = `Server returned ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        } catch (textError) {
          console.error('[createKnowledgeBase] Failed to parse error response:', textError);
        }
      }
      console.error(`[createKnowledgeBase] API error ${response.status}: ${errorMessage}`);
      throw new Error(`Failed to create knowledge base: ${errorMessage}`);
    }
    
    const data = await response.json();
    
    // Check if data is valid
    if (!data || !data.id) {
      console.error('[createKnowledgeBase] Invalid response data:', data);
      throw new Error('Invalid response data from server');
    }
    
    // Ensure the workspaceId is set in the response data
    if (!data.workspaceId) {
      console.log('[createKnowledgeBase] Response missing workspaceId, using provided id:', workspaceId);
      data.workspaceId = workspaceId;
    }
    
    // Verify that the created KB belongs to the correct workspace
    if (data.workspaceId !== workspaceId) {
            console.warn('[createKnowledgeBase] Created KB has different workspace ID:', {
        expected: workspaceId,
        received: data.workspaceId
      });
      // Override the workspace ID to ensure consistency
      data.workspaceId = workspaceId;
      
      // Log the issue to help with debugging
            console.error('[createKnowledgeBase] Workspace ID mismatch in created knowledge base!', {
        kbId: data.id,
                requestedWorkspaceId: workspaceId,
                returnedWorkspaceId: data.workspaceId
      });
    }
    
    console.log(`[createKnowledgeBase] Successfully created knowledge base: ${data.id}`);
    return data;
  } catch (error) {
    console.error('[createKnowledgeBase] Error creating knowledge base:', error);
    throw error;
  }
}

/**
 * List all sources for a knowledge base
 * @param knowledgeBaseId The ID of the knowledge base
 * @param specificWorkspaceId Optional: Provide a specific workspace ID, otherwise uses active workspace
 */
export async function listKnowledgeBaseSources(knowledgeBaseId: string, specificWorkspaceId?: string): Promise<KnowledgeBaseSource[]> {
  try {
    if (!knowledgeBaseId) {
      console.error('[listKnowledgeBaseSources] No knowledge base ID provided');
      return [];
    }

    // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
            console.warn('[listKnowledgeBaseSources] No workspace ID available');
      return [];
    }
    
        console.log(`[listKnowledgeBaseSources] Listing sources for KB: ${knowledgeBaseId} with workspace: ${workspaceId}`);
    
    // Get auth headers with the workspace ID
    const headers = await getAuthHeaders(workspaceId);
    
    // Call the backend API directly
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/sources`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      let errorMessage = `Server returned ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
      } catch (parseError) {
        try {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        } catch (textError) {
          // Ignore text error
        }
      }
      
      // For 404 errors, we need special handling
      if (response.status === 404) {
                console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} not found in workspace ${workspaceId}`);
        
        // Try to check if the knowledge base exists in any workspace
        try {
          const allKbs = await listKnowledgeBases();
          const kb = allKbs.find(kb => kb.id === knowledgeBaseId);
          
          if (kb) {
            // KB exists but in a different workspace
                        console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} found in workspace ${kb.workspaceId}, not ${workspaceId}`);
                        throw new Error(`Knowledge base ${knowledgeBaseId} belongs to workspace ${kb.workspaceId}, not ${workspaceId}`);
          } else {
            // KB doesn't exist at all
                        console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} not found in any workspace`);
                        throw new Error(`Knowledge base ${knowledgeBaseId} not found in any workspace`);
          }
        } catch (err) {
          // Just rethrow the original error if we can't check
          console.error(`[listKnowledgeBaseSources] API error: ${errorMessage}`);
          throw new Error(`Failed to list knowledge base sources: ${errorMessage}`);
        }
      } else {
        console.error(`[listKnowledgeBaseSources] API error: ${errorMessage}`);
        throw new Error(`Failed to list knowledge base sources: ${errorMessage}`);
      }
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      console.log(`[listKnowledgeBaseSources] Retrieved ${data.length} sources for knowledge base ${knowledgeBaseId}`);
      return data;
    }
    
    console.log('[listKnowledgeBaseSources] Invalid response format:', data);
    return [];
  } catch (error) {
    console.error('[listKnowledgeBaseSources] Error listing knowledge base sources:', error);
    throw error; // Rethrow to allow component to handle the error
  }
}

/**
 * Link a file to a knowledge base
 * @param knowledgeBaseId Knowledge base ID
 * @param fileId File ID
 * @param specificWorkspaceId Optional: Provide a specific workspace ID, otherwise uses active workspace
 * @returns The created knowledge base source
 */
export interface ChunkConfigInput {
  strategies?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
}

export async function linkFileToKnowledgeBase(
  knowledgeBaseId: string,
  fileId: string,
  specificWorkspaceId?: string,
  folderId?: string,
  chunkConfig?: ChunkConfigInput
): Promise<KnowledgeBaseSource> {
  try {
    // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
            console.warn('[linkFileToKnowledgeBase] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    if (!knowledgeBaseId) {
      console.error('[linkFileToKnowledgeBase] No knowledge base ID provided');
      throw new Error("Knowledge base ID is required");
    }
    
    if (!fileId) {
      console.error('[linkFileToKnowledgeBase] No file ID provided');
      throw new Error("File ID is required");
    }
    
            console.log(`[linkFileToKnowledgeBase] Linking file ${fileId} to knowledge base ${knowledgeBaseId} in workspace ${workspaceId}`);
    if (folderId) {
      console.log(`[linkFileToKnowledgeBase] With folder ID: ${folderId}`);
    }
    
    // Get auth headers with the workspace ID
        const headers = await getAuthHeaders(workspaceId);
    
    // Build request body - only include folderId if it's a non-empty string
    const requestBody: any = {
      fileId,
      workspaceId: workspaceId,
      sourceType: 'file',
      indexingStatus: 'PENDING',
    };

    // Include chunking configuration when provided
    if (chunkConfig) {
      if (Array.isArray(chunkConfig.strategies) && chunkConfig.strategies.length > 0) {
        requestBody.chunkingStrategy = chunkConfig.strategies;
      }
      if (typeof chunkConfig.chunkSize === 'number') {
        requestBody.chunkSize = chunkConfig.chunkSize;
      }
      if (typeof chunkConfig.chunkOverlap === 'number') {
        requestBody.chunkOverlap = chunkConfig.chunkOverlap;
      }
    }
    
    // Only add folderId if it's a valid non-empty string and matches expected format
    if (folderId && folderId.trim() !== '') {
      const trimmedFolderId = folderId.trim();
      // UUID format: 8-4-4-4-12 characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // CUID format: c + alphanumeric
      const cuidRegex = /^c[a-z0-9]{24,}$/i;
      
      if (uuidRegex.test(trimmedFolderId) || cuidRegex.test(trimmedFolderId)) {
        requestBody.folderId = trimmedFolderId;
        console.log(`[linkFileToKnowledgeBase] Including folderId in request: ${trimmedFolderId}`);
      } else {
        console.warn(`[linkFileToKnowledgeBase] Invalid folderId format, excluding from request: ${trimmedFolderId}`);
      }
    }
    
    console.log(`[linkFileToKnowledgeBase] Request body:`, requestBody);
    
    // Call the backend API directly
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorJson = await response.json();
        errorText = JSON.stringify(errorJson);
      } catch {
        errorText = await response.text();
      }
      console.error(`[linkFileToKnowledgeBase] API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to link file to knowledge base: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[linkFileToKnowledgeBase] Successfully linked file ${fileId} to knowledge base ${knowledgeBaseId}`, data);

    // Ensure the returned data has the correct workspace ID
    if (data) {
      if (!data.workspaceId) {
        data.workspaceId = workspaceId;
            } else if (data.workspaceId !== workspaceId) {
                        console.warn(`[linkFileToKnowledgeBase] Workspace ID mismatch in response: ${data.workspaceId} vs expected ${workspaceId}, fixing...`);
        data.workspaceId = workspaceId;
      }
    }

    return data;
  } catch (error) {
    console.error('[linkFileToKnowledgeBase] Error linking file to knowledge base:', error);
    throw error;
  }
}

/**
 * Link a knowledge base to an assistant
 * @param knowledgeBaseId Knowledge base ID
 * @param assistantId Assistant ID
 * @param specificWorkspaceId Optional: Provide a specific workspace ID, otherwise uses active workspace
 */
export async function linkKnowledgeBaseToAssistant(
  knowledgeBaseId: string,
  assistantId: string,
  specificWorkspaceId?: string
): Promise<any> {
  try {
    // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
            console.warn('[linkKnowledgeBaseToAssistant] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    if (!knowledgeBaseId) {
      console.error('[linkKnowledgeBaseToAssistant] No knowledge base ID provided');
      throw new Error("Knowledge base ID is required");
    }
    
    if (!assistantId) {
      console.error('[linkKnowledgeBaseToAssistant] No assistant ID provided');
      throw new Error("Assistant ID is required");
    }
    
            console.log(`[linkKnowledgeBaseToAssistant] Linking knowledge base ${knowledgeBaseId} to assistant ${assistantId} in workspace ${workspaceId}`);
    
    // Get auth headers with the workspace ID
    const headers = await getAuthHeaders(workspaceId);
    
    // Call the backend API directly
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/link-to-assistant`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        knowledgeBaseId,
        assistantId,
                workspaceId: workspaceId
      })
    });
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorJson = await response.json();
        errorText = JSON.stringify(errorJson);
      } catch {
        errorText = await response.text();
      }
      console.error(`[linkKnowledgeBaseToAssistant] API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to link knowledge base to assistant: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[linkKnowledgeBaseToAssistant] Successfully linked knowledge base ${knowledgeBaseId} to assistant ${assistantId}`);
    return data;
  } catch (error) {
    console.error('[linkKnowledgeBaseToAssistant] Error linking knowledge base to assistant:', error);
    throw error;
  }
}

// Simplified version that makes a direct XMLHttpRequest instead of fetch
export async function directUnlinkRequest(
  knowledgeBaseId: string,
  sourceId: string,
  specificWorkspaceId?: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
      const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId || !knowledgeBaseId || !sourceId) {
        console.error('[directUnlinkRequest] Missing required parameters');
        return reject(new Error('Missing required parameters'));
      }
      
      console.log(`[directUnlinkRequest] Starting direct XMLHttpRequest to delete source ${sourceId}`);
      
      // Create XHR
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', `${API_BASE_URL}/v1/knowledge-bases/sources/${sourceId}`, true);
      
      // Set timeout
      xhr.timeout = 10000; // 10 seconds
      
      // Add headers
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Workspace-ID', workspaceId);
      xhr.setRequestHeader('workspace-id', workspaceId);
      
      // Get auth token and add to request
      const getAndSetAuthToken = async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          
          if (!token) {
            console.error('[directUnlinkRequest] No auth token available');
            return reject(new Error('No authentication token available'));
          }
          
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          
          // Start the request after setting the auth header
          xhr.send();
        } catch (authError) {
          console.error('[directUnlinkRequest] Auth error:', authError);
          reject(authError);
        }
      };
      
      // Set up event handlers
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[directUnlinkRequest] Success - status ${xhr.status}`);
          resolve(true);
        } else {
          // For 404, still consider it successful - DON'T use console.error here
          if (xhr.status === 404) {
            console.warn('[directUnlinkRequest] 404 Not Found, treating as success since item may already be removed');
            console.warn(`[directUnlinkRequest] Response: ${xhr.responseText}`);
            resolve(true);
            return; // Important - return early to avoid the console.error below
          }
          
          // Only log as error for non-404 errors
          console.error(`[directUnlinkRequest] Error - status ${xhr.status}, response: ${xhr.responseText}`);
          reject(new Error(`Request failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };
      
      xhr.onerror = function() {
        console.error('[directUnlinkRequest] Request failed');
        reject(new Error('Network error occurred'));
      };
      
      xhr.ontimeout = function() {
        console.error('[directUnlinkRequest] Request timed out');
        reject(new Error('Request timed out'));
      };
      
      // Start the auth token process
      getAndSetAuthToken();
    } catch (error) {
      console.error('[directUnlinkRequest] Error in request setup:', error);
      reject(error);
    }
  });
}

/**
 * Remove a file from a knowledge base
 * @param knowledgeBaseId Knowledge base ID
 * @param sourceId Source ID to remove (the ID of the KnowledgeBaseSource record)
 * @param workspaceId Optional: Workspace ID
 * @returns Success status
 */
export async function unlinkFileFromKnowledgeBase(
  knowledgeBaseId: string,
  sourceId: string,
  specificWorkspaceId?: string
): Promise<boolean> {
  try {
    console.log(`[unlinkFileFromKnowledgeBase] Starting unlink operation with sourceId=${sourceId}`);
    
    // Try the direct XMLHttpRequest approach first
    try {
      console.log('[unlinkFileFromKnowledgeBase] Attempting direct XMLHttpRequest approach');
      const result = await directUnlinkRequest(knowledgeBaseId, sourceId, specificWorkspaceId);
      console.log('[unlinkFileFromKnowledgeBase] Direct request succeeded:', result);
      return result;
    } catch (directError) {
      console.warn('[unlinkFileFromKnowledgeBase] Direct request failed, falling back to fetch:', directError);
      // Continue with fetch approach
    }
    
    // Regular fetch approach as fallback
    // Use provided workspaceId, or get the current one consistently via getCurrentWorkspaceId
    const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
      console.warn('[unlinkFileFromKnowledgeBase] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    if (!knowledgeBaseId) {
      console.error('[unlinkFileFromKnowledgeBase] No knowledge base ID provided');
      throw new Error("Knowledge base ID is required");
    }
    
    if (!sourceId) {
      console.error('[unlinkFileFromKnowledgeBase] No source ID provided');
      throw new Error("Source ID is required");
    }
    
    console.log(`===== [unlinkFileFromKnowledgeBase] UNLINK REQUEST =====`);
    console.log(`KnowledgeBaseId: ${knowledgeBaseId}`);
    console.log(`SourceId: ${sourceId}`);
        console.log(`WorkspaceId: ${workspaceId}`);
    
    // Get auth headers with the workspace ID
    const headers = await getAuthHeaders(workspaceId);
    console.log(`Authorization headers:`, Object.keys(headers));
    
    // The correct endpoint URL based on backend controller: DELETE /v1/knowledge-bases/sources/:sourceId
    const endpointUrl = `${API_BASE_URL}/v1/knowledge-bases/sources/${sourceId}`;
    console.log(`[unlinkFileFromKnowledgeBase] Calling DELETE ${endpointUrl}`);
    
    // For debugging, log exactly what we're sending to the server
    console.log(`DEBUG - Full request:`, {
      method: 'DELETE',
      url: endpointUrl,
      headers: Object.entries(headers)
        .filter(([key]) => key.toLowerCase().includes('workspace'))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
    });
    
    // Make the actual fetch call with explicit timeout to see if it's hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      // Call the backend API directly using the correct endpoint format
      const response = await fetch(endpointUrl, {
        method: 'DELETE',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`[unlinkFileFromKnowledgeBase] Response received:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });
      
      // Check if the call was successful
      if (response.ok) {
        console.log(`[unlinkFileFromKnowledgeBase] Successfully removed source ${sourceId} from knowledge base ${knowledgeBaseId}`);
        return true;
      }
      
      // Handle error responses
      let errorText = '';
      let errorJson = {};
      
      try {
        errorJson = await response.json();
        errorText = JSON.stringify(errorJson);
      } catch (jsonErr) {
        try {
          errorText = await response.text();
        } catch (textErr) {
          errorText = `Status ${response.status}`;
        }
      }
      
      // For a 404 error, we still want to return success if possible
      // This handles race conditions where the source was already removed
      if (response.status === 404) {
        console.warn(`[unlinkFileFromKnowledgeBase] Source ID ${sourceId} not found (404). Treating as successful removal.`);
        return true;
      }
      
      // Log the error and throw
      console.error(`[unlinkFileFromKnowledgeBase] API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to remove file from knowledge base: ${errorText}`);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[unlinkFileFromKnowledgeBase] Request timed out after 10 seconds');
        throw new Error('Request to remove file timed out');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[unlinkFileFromKnowledgeBase] Error removing file from knowledge base:', error);
    throw error;
  }
}