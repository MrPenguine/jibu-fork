import { NextRequest } from 'next/server';
import { createClient } from '../../../../../utils/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * Server-side API route for streaming agent responses
 * This is needed to proxy the SSE stream from the backend to the frontend
 * while maintaining authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get the request parameter from the URL
    const requestParam = request.nextUrl.searchParams.get('request');
    
    if (!requestParam) {
      return new Response('Missing request parameter', { status: 400 });
    }
    
    const agentRequest = JSON.parse(requestParam);
    
    // Get the Supabase client and session
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // For testing, allow anonymous access
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add auth token if available
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    // Get the active organization ID from cookies or headers
    const orgId = request.cookies.get('activeOrganizationId')?.value;
    if (orgId) {
      headers['X-Organization-ID'] = orgId;
    }
    
    // Get the backend API URL from environment variables
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    
    console.log(`Sending request to ${apiUrl}/v1/agent/stream`);
    
    // Send the request to the backend
    const backendResponse = await fetch(`${apiUrl}/v1/agent/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(agentRequest),
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`Backend API error: ${backendResponse.status} - ${errorText}`);
      return new Response(`Backend API error: ${backendResponse.status} - ${errorText}`, { status: backendResponse.status });
    }
    
    // Create a new ReadableStream to pipe the response
    const stream = new ReadableStream({
      async start(controller) {
        // Process the backend response stream
        const reader = backendResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            // Forward the chunks directly
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Error reading stream:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });
    
    // Return the stream with the appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in stream route:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
