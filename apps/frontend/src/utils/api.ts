import { createClient } from './supabase/client';

/**
 * Base URL for API requests to the backend
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Make an authenticated request to the backend API
 * This automatically adds the Supabase JWT token to the request headers
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
  
  // Prepare request headers with auth token
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
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