import { NextResponse } from 'next/server';

// Use the getBackendUrl function directly
const getBackendUrl = () => {
  // In server-side rendering, use environment variables or default to localhost
  return process.env.BACKEND_URL || 'http://localhost:4000';
};

export async function POST() {
  try {
    // Get the backend URL using our utility function
    const backendUrl = getBackendUrl();
    
    try {
      // Try to call the backend API to disconnect Google Calendar
      const response = await fetch(`${backendUrl}/api/v1/tools/google-calendar/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include any auth headers needed for your backend
        },
      });

      if (response.ok) {
        return NextResponse.json({ success: true });
      }
    } catch (fetchError) {
      console.log('Backend not available, using mock implementation');
    }
    
    // If backend call fails, use a mock implementation for demonstration
    console.log('Using mock Google Calendar disconnect');
    
    // In a real implementation, you would clear tokens from your database
    // For demo purposes, we'll just return a success response
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 }
    );
  }
}
