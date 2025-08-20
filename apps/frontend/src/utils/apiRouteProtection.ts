import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { API_BASE_URL } from './api';

/**
 * Helper function to protect API routes with authentication and workspace context
 * @param request The Next.js request object
 * @param handler The handler function to execute if authenticated (receives session, workspaceId, and request)
 * @param options Configuration options
 * @returns NextResponse
 */
export async function withAuthAndWorkspace(
  request: NextRequest,
  handler: (
    session: any, 
    workspaceId: string | null, 
    request: NextRequest
  ) => Promise<NextResponse>,
  options: {
    requireWorkspace?: boolean; // Whether workspace context is required
    allowedRoles?: string[]; // Restrict to specific roles (requires workspace context)
  } = {}
): Promise<NextResponse> {
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get workspace ID from request headers
    let workspaceId = request.headers.get('x-workspace-id');
    
    // If there's no workspace ID in headers but it's required, try to get from API
    if (!workspaceId && (options.requireWorkspace || options.allowedRoles)) {
      try {
        // Call backend to get user's active workspace
        const workspaceResponse = await fetch(`${API_BASE_URL}/users/context`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!workspaceResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch user context' },
            { status: 500 }
          );
        }
        
        const workspaceData = await workspaceResponse.json();
        workspaceId = workspaceData.workspaceId;
        
        // If workspace is still not found but required
        if (!workspaceId && options.requireWorkspace) {
          return NextResponse.json(
            { error: 'No active workspace' },
            { status: 400 }
          );
        }
        
        // Check role restrictions if specified
        if (options.allowedRoles && options.allowedRoles.length > 0) {
          if (!workspaceData.workspaceRole || !options.allowedRoles.includes(workspaceData.workspaceRole)) {
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }
      } catch (error) {
        console.error('Error fetching workspace context:', error);
        return NextResponse.json(
          { error: 'Failed to fetch workspace context' },
          { status: 500 }
        );
      }
    }
    
    // Call the handler with authentication and workspace context
    return await handler(session, workspaceId, request);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}