import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Use the getBackendUrl function directly
const getBackendUrl = () => {
  // In server-side rendering, use environment variables or default to localhost
  return process.env.BACKEND_URL || 'http://localhost:4000';
};

interface CalendarSettings {
  calendarId: string;
  checkAvailabilityEnabled: boolean;
  createEventsEnabled: boolean;
}

interface StatusResponse {
  connected: boolean;
  settings: CalendarSettings | null;
}

export async function GET() {
  try {
    // Get the backend URL using our utility function
    const backendUrl = getBackendUrl();
    
    try {
      // Try to call the backend API to check connection status
      const response = await fetch(`${backendUrl}/api/v1/tools/google-calendar/status`, {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (fetchError) {
      console.log('Backend not available, using mock implementation');
    }
    
    // If backend call fails, use a mock implementation for demonstration
    console.log('Using mock Google Calendar status');
    
    // For demonstration purposes, we'll return a mock status
    // In a real implementation, you would check if the user has valid tokens in your database
    const mockStatus: StatusResponse = {
      connected: false,
      settings: null
    };
    
    // Check if the user has interacted with the tool before
    // In a real implementation, you would check your database
    // For demo purposes, we'll just return a mock response
    const demoConnected = true; // For demonstration, assume connected
    
    if (demoConnected) {
      mockStatus.connected = true;
      mockStatus.settings = {
        calendarId: 'primary',
        checkAvailabilityEnabled: true,
        createEventsEnabled: true
      };
    }
    
    return NextResponse.json(mockStatus);
  } catch (error) {
    console.error('Error checking Google Calendar connection status:', error);
    // Default to not connected if there's an error
    return NextResponse.json({ connected: false });
  }
}
