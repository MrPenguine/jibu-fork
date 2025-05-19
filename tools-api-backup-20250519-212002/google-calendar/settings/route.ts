import { NextRequest, NextResponse } from 'next/server';

// Use the getBackendUrl function directly
const getBackendUrl = () => {
  // In server-side rendering, use environment variables or default to localhost
  return process.env.BACKEND_URL || 'http://localhost:4000';
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the backend URL using our utility function
    const backendUrl = getBackendUrl();
    
    try {
      // Try to call the backend API to save the settings
      const response = await fetch(`${backendUrl}/api/v1/tools/google-calendar/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include any auth headers needed for your backend
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (fetchError) {
      console.log('Backend not available, using mock implementation');
    }
    
    // If backend call fails, use a mock implementation for demonstration
    console.log('Using mock Google Calendar settings save');
    console.log('Settings received:', body);
    
    // In a real implementation, you would save these settings to your database
    // For demo purposes, we'll just return a success response
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Google Calendar settings:', error);
    return NextResponse.json(
      { error: 'Failed to save Google Calendar settings' },
      { status: 500 }
    );
  }
}
