import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndWorkspace } from '../../../../../utils/apiRouteProtection';

// API route to handle n8n workflows
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
        
        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/workflows`;
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { 
              success: false, 
              message: errorData.message || 'Failed to fetch n8n workflows',
              status: response.status
            },
            { status: response.status }
          );
        }
        
        const responseData = await response.json();
        return NextResponse.json(responseData, { status: 200 });
      } catch (error) {
        console.error('Error in n8n workflows API route:', error);
        return NextResponse.json(
          { success: false, message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    { requireWorkspace: true }
  );
}

// API route to create or update n8n workflows
export async function POST(req: NextRequest) {
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
        
        const requestBody = await req.json();
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId,
        } as Record<string, string>;
        
        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/workflows`;
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details available');
          console.error(`[n8n/workflows] Server response error (${response.status}):`, errorText);
          
          return NextResponse.json(
            { 
              success: false, 
              message: `Failed to create/update n8n workflow: ${response.statusText}`,
              details: errorText,
              status: response.status
            },
            { status: response.status }
          );
        }
        
        const responseData = await response.json();
        return NextResponse.json(responseData, { status: 201 });
      } catch (error) {
        console.error('Error in n8n workflows API route (POST):', error);
        return NextResponse.json(
          { success: false, message: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    { requireWorkspace: true }
  );
}
