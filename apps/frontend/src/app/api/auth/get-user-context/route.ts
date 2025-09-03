import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { API_BASE_URL } from '../../../../utils/api';

export async function GET(request: NextRequest) {
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
    
    // Resolve last workspace first so we can include X-Workspace-ID where needed
    try {
      // Try to get last workspace (does not require X-Workspace-ID)
      let workspaceId: string | undefined;
      try {
        const wsResp = await fetch(`${API_BASE_URL}/users/last-workspace`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (wsResp.ok) {
          const wsData = await wsResp.json();
          // Support either direct id or nested shape
          workspaceId = wsData?.id || wsData?.workspace?.id;
        }
      } catch (e) {
        // Non-fatal: user may not have a workspace yet
      }

      // Now call backend API to get user's context (include workspace header when available)
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };
      if (workspaceId) {
        headers['X-Workspace-ID'] = workspaceId;
        headers['workspace-id'] = workspaceId;
      }

      const response = await fetch(`${API_BASE_URL}/users/context`, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user context: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('Error fetching user context:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user context' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in get-user-context:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}