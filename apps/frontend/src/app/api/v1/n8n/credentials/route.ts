import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndWorkspace } from '../../../../../utils/apiRouteProtection';

// API route to fetch all n8n credential types
export async function GET(req: NextRequest) {
  return withAuthAndWorkspace(
    req,
    async (session, workspaceId, request) => {
      try {
        if (!workspaceId) {
          return NextResponse.json(
            { success: false, message: 'Workspace ID is required' },
            { status: 400 }
          );
        }
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId,
        } as Record<string, string>;
        
        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/credentials`;
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { 
              success: false, 
              message: errorData.message || 'Failed to fetch n8n credential types',
              status: response.status
            },
            { status: response.status }
          );
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.log('Detected HTML response from content-type header, returning empty array fallback');
          return NextResponse.json([], { status: 200 });
        }
        
        try {
          const responseData = await response.json();
          return NextResponse.json(responseData, { status: 200 });
        } catch (parseError) {
          console.error('Failed to parse backend response as JSON:', parseError);
          console.log('JSON parsing failed, returning empty array fallback');
          return NextResponse.json([], { status: 200 });
        }
      } catch (error) {
        console.error('Error in n8n credentials API route:', error);
        return NextResponse.json(
          { success: false, message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    { requireWorkspace: true }
  );
}
