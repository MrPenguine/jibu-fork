import { createClient } from './supabase/client';

/**
 * Base URL for API requests to the backend
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Get the active organization ID from localStorage
 */
export function getActiveOrganizationId(): string | null {
  try {
    return localStorage.getItem('activeOrganizationId');
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
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
  
  // Get the active organization ID from localStorage
  const activeOrganizationId = getActiveOrganizationId();
  
  // Prepare request headers with auth token and org ID if available
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...(activeOrganizationId ? { 'X-Organization-ID': activeOrganizationId } : {}),
    ...options.headers,
  };
  
  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
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
} 