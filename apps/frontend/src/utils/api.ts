import { createClient } from './supabase/client';
import { getActiveWorkspaceId } from './fileApi';

/**
 * Base URL for API requests to the backend
 */
export const API_BASE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const url = new URL(raw);
    // Ensure the base URL includes the '/api' prefix expected by the Nest global prefix
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/api';
    } else if (!url.pathname.endsWith('/api') && !url.pathname.endsWith('/api/')) {
      url.pathname = url.pathname.replace(/\/$/, '') + '/api';
    }
    // Remove trailing slash for consistent `${API_BASE_URL}${endpoint}` concatenation
    return url.toString().replace(/\/$/, '');
  } catch {
    // If env var is not a valid URL string, fallback to simple concatenation
    return raw.replace(/\/$/, '') + '/api';
  }
})();

/**
 * Get the active workspace ID from localStorage
 */
export function getActiveWorkspaceIdInternal(): string | null {
  // Use the shared implementation to ensure consistency
  return getActiveWorkspaceId();
}

/**
 * Make an authenticated request to the backend API
 * This automatically adds the Supabase JWT token to the request headers
 * and includes the active workspace ID if available
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
  
  // Get the active workspace ID using the consistent helper function
  const activeWorkspaceId = getActiveWorkspaceId();
  
  // Prepare request headers with auth token and workspace ID if available
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...(activeWorkspaceId ? { 'X-Workspace-ID': activeWorkspaceId, 'workspace-id': activeWorkspaceId } : {}),
    ...options.headers,
  };
  
  // Calculate the full URL
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    // Make the request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for webhook testing
    
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
      errorMessage = 'Request timed out after 30 seconds';
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMessage = 'Network error: Unable to connect to the server. Please check your connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error(`API Error (${endpoint}):`, errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get the backend API URL based on the environment
 */
export function getBackendUrl(): string {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // In development, we use the local backend
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:4000';
    }
    
    // In production, we use the same host as the frontend
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  // In server-side rendering, use environment variables
  return process.env.BACKEND_URL || 'http://localhost:4000';
} 