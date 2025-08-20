import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndWorkspace } from '../../../../../../utils/apiRouteProtection';

// API route to fetch details for a specific n8n node type
export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  return withAuthAndWorkspace(
    req,
    async (session, workspaceId) => {
      try {
        // Get the node type from the route parameters
        const { type } = params;
        
        if (!type) {
          return NextResponse.json(
            { success: false, message: 'Node type is required' },
            { status: 400 }
          );
        }
        
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: 'Workspace ID is required' },
            { status: 400 }
          );
        }
        
        // Prepare headers for the backend request
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId,
        } as Record<string, string>;
        
        // Forward the request to the backend API
        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/nodes/${encodeURIComponent(type)}`;
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers,
        });
        
        // Check if the backend request was successful
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { 
              success: false, 
              message: errorData.message || `Failed to fetch details for node type: ${type}`,
              status: response.status
            },
            { status: response.status }
          );
        }
        
        // Check if the response is HTML instead of JSON based on content-type header
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.log('Detected HTML response from content-type header, returning empty object fallback');
          return NextResponse.json({}, { status: 200 });
        }
        
        // Return the response from the backend
        try {
          const responseData = await response.json();
          // Return the data directly without wrapping it
          return NextResponse.json(responseData, { status: 200 });
        } catch (parseError) {
          console.error('Failed to parse backend response as JSON:', parseError);
          
          // Since we already checked content-type, if we're here it's likely a malformed JSON
          // Return an empty object as fallback to prevent frontend crashes
          console.log('JSON parsing failed, returning empty object fallback');
          return NextResponse.json({}, { status: 200 });
        }
      } catch (error) {
        console.error('Error in n8n node details API route:', error);
        return NextResponse.json(
          { success: false, message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    { requireWorkspace: true }
  );
}
