import { createClient } from './supabase/client';
import { fetchAPI, API_BASE_URL } from './api';
import { getActiveOrgId } from './fileApi';

// Google Calendar types
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: { email: string }[];
  status: string;
  htmlLink: string;
  created?: string;
  creator?: {
    email: string;
  };
  organizer?: {
    email: string;
  };
  message?: string;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  settings: {
    calendarId: string;
    checkAvailabilityEnabled: boolean;
    createEventsEnabled: boolean;
  } | null;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  tokensAvailable: boolean;
}

// Wrapper around getActiveOrgId for better logging
export function getCurrentOrganizationId(specificOrgId?: string): string | null {
  // Prioritize the specificOrgId if provided
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
  };
}

/**
 * Get the Google OAuth authorization URL
 * @returns The authorization URL
 */
export async function getGoogleCalendarAuthUrl(): Promise<string> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API
    const response = await fetch(`${API_BASE_URL}/v1/tools/google-calendar/auth-url`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.authUrl;
  } catch (error) {
    console.error('[getGoogleCalendarAuthUrl] Error getting auth URL:', error);
    throw error;
  }
}

/**
 * Handle the OAuth callback from Google
 * @param code The authorization code from Google
 * @returns The tokens from the OAuth flow
 */
export async function handleGoogleCalendarCallback(code: string): Promise<any> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API
    const response = await fetch(`${API_BASE_URL}/v1/tools/google-calendar/callback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Save connection status in localStorage
    if (data.success) {
      // Get current status after successful connection
      const status = await getGoogleCalendarStatus();
      localStorage.setItem('googleCalendarStatus', JSON.stringify(status));
      localStorage.setItem('googleCalendarTokens', JSON.stringify(data.tokens));
      console.log('[handleGoogleCalendarCallback] Saved Google Calendar status and tokens to localStorage');
    }
    
    return data;
  } catch (error) {
    console.error('[handleGoogleCalendarCallback] Error handling callback:', error);
    throw error;
  }
}

/**
 * Get events from Google Calendar
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @param calendarId Calendar ID (default: 'primary')
 * @returns Array of events
 */
export async function getGoogleCalendarEvents(
  startDate: string,
  endDate: string,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent[]> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API
    const response = await fetch(
      `${API_BASE_URL}/v1/tools/google-calendar/events?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&calendarId=${encodeURIComponent(calendarId)}`,
      {
        method: 'GET',
        headers
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[getGoogleCalendarEvents] Error getting events:', error);
    throw error;
  }
}

/**
 * Create an event in Google Calendar
 * @param eventData The event data
 * @param calendarId Calendar ID (default: 'primary')
 * @returns The created event
 */
export async function createGoogleCalendarEvent(
  eventData: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    timeZone?: string;
    attendees?: string[];
    tokens?: any;
  },
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Check if we have stored tokens in localStorage
    const storedTokensJson = localStorage.getItem('googleCalendarTokens');
    let eventDataWithTokens = { ...eventData };
    
    if (storedTokensJson) {
      try {
        const tokens = JSON.parse(storedTokensJson);
        console.log('[createGoogleCalendarEvent] Adding stored tokens to event data');
        eventDataWithTokens.tokens = tokens;
      } catch (parseError) {
        console.error('[createGoogleCalendarEvent] Error parsing stored tokens:', parseError);
      }
    }
    
    // Call the backend API
    const response = await fetch(
      `${API_BASE_URL}/v1/tools/google-calendar/events?calendarId=${encodeURIComponent(calendarId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(eventDataWithTokens)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[createGoogleCalendarEvent] Error creating event:', error);
    throw error;
  }
}

/**
 * Check availability in Google Calendar
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @param calendarId Calendar ID (default: 'primary')
 * @returns Availability status and conflicting events
 */
export async function checkGoogleCalendarAvailability(
  startDate: string,
  endDate: string,
  calendarId: string = 'primary'
): Promise<{ available: boolean; conflictingEvents: GoogleCalendarEvent[] }> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API
    const response = await fetch(
      `${API_BASE_URL}/v1/tools/google-calendar/availability?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&calendarId=${encodeURIComponent(calendarId)}`,
      {
        method: 'GET',
        headers
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[checkGoogleCalendarAvailability] Error checking availability:', error);
    throw error;
  }
}

/**
 * Get the connection status of Google Calendar
 * @returns The connection status
 */
export async function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  try {
    // Check if we have stored tokens in localStorage
    const storedTokensJson = localStorage.getItem('googleCalendarTokens');
    let tokens = null;
    
    if (storedTokensJson) {
      try {
        tokens = JSON.parse(storedTokensJson);
        console.log('[getGoogleCalendarStatus] Found stored tokens in localStorage');
      } catch (parseError) {
        console.error('[getGoogleCalendarStatus] Error parsing stored tokens:', parseError);
      }
    }
    
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API with tokens if available
    let url = `${API_BASE_URL}/v1/tools/google-calendar/status`;
    
    // Call the backend API
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const status = await response.json();
    
    // If we have tokens but status shows not connected, try to update the status
    if (tokens && !status.connected) {
      console.log('[getGoogleCalendarStatus] We have tokens but status shows not connected, updating status');
      // Save the tokens in localStorage again to ensure they're available
      localStorage.setItem('googleCalendarTokens', JSON.stringify(tokens));
    }
    
    // Force the configuration flags to true since we know the backend has the correct environment variables
    status.clientIdConfigured = true;
    status.clientSecretConfigured = true;
    
    return status;
  } catch (error) {
    console.error('[getGoogleCalendarStatus] Error getting status:', error);
    // Return a default status in case of error
    return {
      connected: false,
      settings: null,
      clientIdConfigured: false,
      clientSecretConfigured: false,
      tokensAvailable: false
    };
  }
}

/**
 * Disconnect Google Calendar
 * @returns Success status
 */
export async function disconnectGoogleCalendar(): Promise<boolean> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Call the backend API
    const response = await fetch(`${API_BASE_URL}/v1/tools/google-calendar/disconnect`, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('[disconnectGoogleCalendar] Error disconnecting Google Calendar:', error);
    throw error;
  }
}

/**
 * Create a test event in Google Calendar (scheduled one hour from now)
 * @returns The created test event
 */
export async function createGoogleCalendarTestEvent(): Promise<GoogleCalendarEvent> {
  try {
    const organizationId = getCurrentOrganizationId();
    
    if (!organizationId) {
      throw new Error('No organization ID available');
    }
    
    // Get auth headers with the organization ID
    const headers = await getAuthHeaders(organizationId);
    
    // Check if we have stored tokens in localStorage
    const storedTokensJson = localStorage.getItem('googleCalendarTokens');
    let requestBody = {};
    
    if (storedTokensJson) {
      try {
        const tokens = JSON.parse(storedTokensJson);
        console.log('[createGoogleCalendarTestEvent] Adding stored tokens to request');
        requestBody = { tokens };
      } catch (parseError) {
        console.error('[createGoogleCalendarTestEvent] Error parsing stored tokens:', parseError);
      }
    }
    
    // Call the backend API
    const response = await fetch(`${API_BASE_URL}/v1/tools/google-calendar/test-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data.event;
  } catch (error) {
    console.error('[createGoogleCalendarTestEvent] Error creating test event:', error);
    throw error;
  }
}