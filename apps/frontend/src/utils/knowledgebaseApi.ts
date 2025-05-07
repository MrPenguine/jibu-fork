import { createClient } from './supabase/client';
import { getActiveOrgId } from './fileApi';
import { fetchAPI, API_BASE_URL } from './api';

// Import organization context for types only
import { useOrganization } from './organizationContext';

// Knowledge base types
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
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

// Wrapper around getActiveOrgId for better logging
export function getCurrentOrganizationId(specificOrgId?: string): string | null {
  // Prioritize the specificOrgId if provided (could be from the assistant or props)
  if (specificOrgId) {
    console.log(`[getCurrentOrganizationId] Using provided specific organization ID: ${specificOrgId}`);
    return specificOrgId;
  }
  
  // Try to get organization ID from local storage or other sources
  const orgId = getActiveOrgId();
  
  // Add extra logging for debugging purposes
  if (orgId) {
    console.log(`[getCurrentOrganizationId] Using organization ID from active context: ${orgId}`);
  } else {
    console.warn('[getCurrentOrganizationId] No organization ID available from any source');
  }
  
  return orgId;
}

// Get authorization headers with token and organization ID
async function getAuthHeaders(orgId: string) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Organization-ID': orgId,
    'organization-id': orgId, // Some endpoints might expect this format
    'X-Force-Organization-ID': orgId, // Extra header for debugging/clarity
  };
}

/**
 * List all knowledge bases for the current organization
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function listKnowledgeBases(specificOrgId?: string): Promise<KnowledgeBase[]> {
  try {
    // Use the provided specificOrgId or get from getCurrentOrganizationId
    const organizationId = getCurrentOrganizationId(specificOrgId);
    
    if (!organizationId) {
      console.warn('[listKnowledgeBases] No organization ID available, results may be limited');
    } else {
      console.log(`[listKnowledgeBases] Using organization ID in headers: ${organizationId}`);
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId || '');
    
    // Call the backend API directly, organization ID is passed in headers
    console.log(`[listKnowledgeBases] Requesting knowledge bases with organization headers:`, 
      Object.entries(headers)
        .filter(([key]) => key.toLowerCase().includes('organization'))
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
      console.log(`[listKnowledgeBases] Found ${knowledgeBases.length} knowledge bases for org ${organizationId || 'unknown'}`);
      
      if (knowledgeBases.length > 0) {
        // Log organization distribution for debugging
        const orgCounts = knowledgeBases.reduce((acc, kb) => {
          const orgId = kb.organizationId || 'unknown';
          acc[orgId] = (acc[orgId] || 0) + 1;
          return acc;
        }, {});
        
        console.log(`[listKnowledgeBases] Knowledge bases by organization:`, orgCounts);
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
 * Create a new knowledge base
 * @param name The name of the knowledge base
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function createKnowledgeBase(name: string, specificOrgId?: string): Promise<KnowledgeBase> {
  try {
    // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
    const organizationId = getCurrentOrganizationId(specificOrgId);
    
    if (!organizationId) {
      const error = new Error('[createKnowledgeBase] No organization ID available');
      console.error(error);
      throw error;
    }
    
    console.log(`[createKnowledgeBase] Creating knowledge base "${name}" for org: ${organizationId}`);
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API directly with the organization ID explicitly in the body
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        organizationId
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
    
    // Ensure the organizationId is set in the response data
    if (!data.organizationId) {
      console.log('[createKnowledgeBase] Response missing organizationId, using provided id:', organizationId);
      data.organizationId = organizationId;
    }
    
    // Verify that the created KB belongs to the correct organization
    if (data.organizationId !== organizationId) {
      console.warn('[createKnowledgeBase] Created KB has different organization ID:', {
        expected: organizationId,
        received: data.organizationId
      });
      // Override the organization ID to ensure consistency
      data.organizationId = organizationId;
      
      // Log the issue to help with debugging
      console.error('[createKnowledgeBase] Organization ID mismatch in created knowledge base!', {
        kbId: data.id,
        requestedOrgId: organizationId,
        returnedOrgId: data.organizationId
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
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function listKnowledgeBaseSources(knowledgeBaseId: string, specificOrgId?: string): Promise<KnowledgeBaseSource[]> {
  try {
    if (!knowledgeBaseId) {
      console.error('[listKnowledgeBaseSources] No knowledge base ID provided');
      return [];
    }

    // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
    const organizationId = getCurrentOrganizationId(specificOrgId);
    
    if (!organizationId) {
      console.warn('[listKnowledgeBaseSources] No organization ID available');
      return [];
    }
    
    console.log(`[listKnowledgeBaseSources] Listing sources for KB: ${knowledgeBaseId} with org: ${organizationId}`);
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
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
        console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} not found in organization ${organizationId}`);
        
        // Try to check if the knowledge base exists in any organization
        try {
          const allKbs = await listKnowledgeBases();
          const kb = allKbs.find(kb => kb.id === knowledgeBaseId);
          
          if (kb) {
            // KB exists but in a different organization
            console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} found in organization ${kb.organizationId}, not ${organizationId}`);
            throw new Error(`Knowledge base ${knowledgeBaseId} belongs to organization ${kb.organizationId}, not ${organizationId}`);
          } else {
            // KB doesn't exist at all
            console.error(`[listKnowledgeBaseSources] Knowledge base ${knowledgeBaseId} not found in any organization`);
            throw new Error(`Knowledge base ${knowledgeBaseId} not found in any organization`);
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
 * @param organizationId Organization ID
 * @returns The created knowledge base source
 */
export async function linkFileToKnowledgeBase(
  knowledgeBaseId: string,
  fileId: string,
  organizationId?: string
): Promise<KnowledgeBaseSource> {
  try {
    // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
    const orgId = getCurrentOrganizationId(organizationId);
    
    if (!orgId) {
      console.warn('[linkFileToKnowledgeBase] No active organization selected.');
      throw new Error("No active organization selected");
    }
    
    if (!knowledgeBaseId) {
      console.error('[linkFileToKnowledgeBase] No knowledge base ID provided');
      throw new Error("Knowledge base ID is required");
    }
    
    if (!fileId) {
      console.error('[linkFileToKnowledgeBase] No file ID provided');
      throw new Error("File ID is required");
    }
    
    console.log(`[linkFileToKnowledgeBase] Linking file ${fileId} to knowledge base ${knowledgeBaseId} in org ${orgId}`);
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(orgId);
    
    // Call the backend API directly
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileId,
        organizationId: orgId,
        sourceType: 'file',
        indexingStatus: 'PENDING'
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
      console.error(`[linkFileToKnowledgeBase] API error: ${response.status} ${errorText}`);
      throw new Error(`Failed to link file to knowledge base: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[linkFileToKnowledgeBase] Successfully linked file ${fileId} to knowledge base ${knowledgeBaseId}`, data);

    // Ensure the returned data has the correct organization ID
    if (data) {
      if (!data.organizationId) {
        data.organizationId = orgId;
      } else if (data.organizationId !== orgId) {
        console.warn(`[linkFileToKnowledgeBase] Organization ID mismatch in response: ${data.organizationId} vs expected ${orgId}, fixing...`);
        data.organizationId = orgId;
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
 * @param organizationId Optional: Organization ID
 */
export async function linkKnowledgeBaseToAssistant(
  knowledgeBaseId: string,
  assistantId: string,
  organizationId?: string
): Promise<any> {
  try {
    // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
    const orgId = getCurrentOrganizationId(organizationId);
    
    if (!orgId) {
      console.warn('[linkKnowledgeBaseToAssistant] No active organization selected.');
      throw new Error("No active organization selected");
    }
    
    if (!knowledgeBaseId) {
      console.error('[linkKnowledgeBaseToAssistant] No knowledge base ID provided');
      throw new Error("Knowledge base ID is required");
    }
    
    if (!assistantId) {
      console.error('[linkKnowledgeBaseToAssistant] No assistant ID provided');
      throw new Error("Assistant ID is required");
    }
    
    console.log(`[linkKnowledgeBaseToAssistant] Linking knowledge base ${knowledgeBaseId} to assistant ${assistantId} in org ${orgId}`);
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(orgId);
    
    // Call the backend API directly
    const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/link-to-assistant`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        knowledgeBaseId,
        assistantId,
        organizationId: orgId
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
  organizationId?: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
      const orgId = getCurrentOrganizationId(organizationId);
      
      if (!orgId || !knowledgeBaseId || !sourceId) {
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
      xhr.setRequestHeader('X-Organization-ID', orgId);
      xhr.setRequestHeader('organization-id', orgId);
      
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
 * @param organizationId Optional: Organization ID
 * @returns Success status
 */
export async function unlinkFileFromKnowledgeBase(
  knowledgeBaseId: string,
  sourceId: string,
  organizationId?: string
): Promise<boolean> {
  try {
    console.log(`[unlinkFileFromKnowledgeBase] Starting unlink operation with sourceId=${sourceId}`);
    
    // Try the direct XMLHttpRequest approach first
    try {
      console.log('[unlinkFileFromKnowledgeBase] Attempting direct XMLHttpRequest approach');
      const result = await directUnlinkRequest(knowledgeBaseId, sourceId, organizationId);
      console.log('[unlinkFileFromKnowledgeBase] Direct request succeeded:', result);
      return result;
    } catch (directError) {
      console.warn('[unlinkFileFromKnowledgeBase] Direct request failed, falling back to fetch:', directError);
      // Continue with fetch approach
    }
    
    // Regular fetch approach as fallback
    // Use provided orgId, or get the current one consistently via getCurrentOrganizationId
    const orgId = getCurrentOrganizationId(organizationId);
    
    if (!orgId) {
      console.warn('[unlinkFileFromKnowledgeBase] No active organization selected.');
      throw new Error("No active organization selected");
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
    console.log(`OrgId: ${orgId}`);
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(orgId);
    console.log(`Authorization headers:`, Object.keys(headers));
    
    // The correct endpoint URL based on backend controller: DELETE /v1/knowledge-bases/sources/:sourceId
    const endpointUrl = `${API_BASE_URL}/v1/knowledge-bases/sources/${sourceId}`;
    console.log(`[unlinkFileFromKnowledgeBase] Calling DELETE ${endpointUrl}`);
    
    // For debugging, log exactly what we're sending to the server
    console.log(`DEBUG - Full request:`, {
      method: 'DELETE',
      url: endpointUrl,
      headers: Object.entries(headers)
        .filter(([key]) => key.toLowerCase().includes('organization'))
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