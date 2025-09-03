import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndWorkspace } from '../../../../../../utils/apiRouteProtection';

// API route to handle specific n8n workflow by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuthAndWorkspace(
    req,
    async (session, workspaceId) => {
      try {
        const { id } = params;
        if (!id) {
          return NextResponse.json({ success: false, message: 'Workflow ID is required' }, { status: 400 });
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId!,
          'workspace-id': workspaceId!,
        };

        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/workflows/${id}`;
        const response = await fetch(backendUrl, { method: 'GET', headers });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { success: false, message: errorData.message || `Failed to fetch n8n workflow with ID: ${id}`, status: response.status },
            { status: response.status }
          );
        }

        const responseData = await response.json();
        return NextResponse.json(responseData, { status: 200 });
      } catch (error) {
        console.error('Error in n8n workflow API route:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
      }
    },
    { requireWorkspace: true }
  );
}

// API route to update a specific n8n workflow
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuthAndWorkspace(
    req,
    async (session, workspaceId) => {
      try {
        const { id } = params;
        if (!id) {
          return NextResponse.json({ success: false, message: 'Workflow ID is required' }, { status: 400 });
        }

        const requestBody = await req.json();
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId!,
          'workspace-id': workspaceId!,
        };

        console.log(`[n8n/workflows/${id}] Updating workflow with data:`, requestBody);
        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/workflows/${id}`;
        console.log(`[n8n/workflows/${id}] Using API URL: ${backendUrl}`);

        const response = await fetch(backendUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details available');
          console.error(`[n8n/workflows/${id}] Server response error (${response.status}):`, errorText);
          return NextResponse.json(
            { success: false, message: `Failed to update n8n workflow: ${response.statusText}`, details: errorText, status: response.status },
            { status: response.status }
          );
        }

        const responseData = await response.json();
        return NextResponse.json(responseData, { status: 200 });
      } catch (error) {
        console.error('Error in n8n workflow API route (PUT):', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
      }
    },
    { requireWorkspace: true }
  );
}

// API route to delete a specific n8n workflow
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuthAndWorkspace(
    req,
    async (session, workspaceId) => {
      try {
        const { id } = params;
        if (!id) {
          return NextResponse.json({ success: false, message: 'Workflow ID is required' }, { status: 400 });
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Workspace-ID': workspaceId!,
          'workspace-id': workspaceId!,
        };

        const backendUrl = `${process.env.BACKEND_API_URL || 'http://localhost:4000/api'}/v1/n8n/workflows/${id}`;
        const response = await fetch(backendUrl, { method: 'DELETE', headers });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { success: false, message: errorData.message || `Failed to delete n8n workflow with ID: ${id}`, status: response.status },
            { status: response.status }
          );
        }

        return NextResponse.json({ success: true, message: 'Workflow deleted successfully' }, { status: 200 });
      } catch (error) {
        console.error('Error in n8n workflow API route (DELETE):', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
      }
    },
    { requireWorkspace: true }
  );
}
