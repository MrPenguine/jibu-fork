import { NextResponse } from 'next/server';

// Use the getBackendUrl function directly
const getBackendUrl = () => {
  // In server-side rendering, use environment variables or default to localhost
  return process.env.BACKEND_URL || 'http://localhost:4000';
};

export async function GET() {
  try {
    // Get the backend URL using our utility function
    const backendUrl = getBackendUrl();
    
    try {
      // Try to call the backend API to get the auth URL
      const response = await fetch(`${backendUrl}/api/v1/tools/google-calendar/auth-url`, {
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
    console.log('Using mock Google Calendar auth URL');
    
    // Create a mock Google OAuth URL
    // In a real implementation, this would come from the backend
    // This is just for demonstration purposes
    const mockAuthUrl = 'https://accounts.google.com/o/oauth2/auth?' + 
      'client_id=993968713581-tvn13hknkib42l31u8ra2pefvtm4cda3.apps.googleusercontent.com&' +
      'redirect_uri=http://localhost:3000/api/auth/callback/google&' +
      'response_type=code&' +
      'scope=https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events&' +
      'access_type=offline&' +
      'prompt=consent';
    
    return NextResponse.json({ authUrl: mockAuthUrl });
  } catch (error) {
    console.error('Error getting Google Calendar auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to get Google Calendar auth URL' },
      { status: 500 }
    );
  }
}
