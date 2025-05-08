import { createClient } from './supabase/client';
import { getActiveOrgId } from './fileApi';

/**
 * Base URL for API requests to the backend
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Get the active organization ID from localStorage (DEPRECATED)
 * Use getActiveOrgId from fileApi.ts instead
 */
export function getActiveOrganizationId(): string | null {
  // Use the shared implementation to ensure consistency
  return getActiveOrgId();
}

/**
 * Make an authenticated request to the backend API
 * This automatically adds the Supabase JWT token to the request headers
 * and includes the active organization ID if available
 */
export async function fetchAPI(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const supabase = createClient();
  
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No active session. User must be authenticated to make this request.');
  }
  
  // Get the active organization ID using the consistent helper function
  const activeOrganizationId = getActiveOrgId();
  
  // Prepare request headers with auth token and org ID if available
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...(activeOrganizationId ? { 'X-Organization-ID': activeOrganizationId } : {}),
    ...options.headers,
  };
  
  // Calculate the full URL
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    // Make the request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
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
  } catch (error: any) {
    // Format error message based on error type
    let errorMessage = 'Unknown error occurred';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out after 10 seconds';
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMessage = 'Network error: Unable to connect to the server. Please check your connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error(`API Error (${endpoint}):`, errorMessage);
    throw new Error(errorMessage);
  }
} 