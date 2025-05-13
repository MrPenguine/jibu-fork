import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '../../../../lib/api';

// Proxy GET requests to the backend API
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assistantId = params.id;
    const backendUrl = `${getBackendUrl()}/api/assistants/${assistantId}`;
    console.log(`Proxying GET request to ${backendUrl}`);
    
    const headers = new Headers(request.headers);
    
    // Forward the request to the backend API
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    
    // Get the response data
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying GET request to assistants API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 