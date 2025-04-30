import { NextRequest, NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { API_BASE_URL } from './api';

/**
 * Helper function to protect API routes with authentication and organization context
 * @param request The Next.js request object
 * @param handler The handler function to execute if authenticated (receives session, organizationId, and request)
 * @param options Configuration options
 * @returns NextResponse
 */
export async function withAuthAndOrg(
  request: NextRequest,
  handler: (
    session: any, 
    organizationId: string | null, 
    request: NextRequest
  ) => Promise<NextResponse>,
  options: {
    requireOrg?: boolean; // Whether organization context is required
    allowedRoles?: string[]; // Restrict to specific roles (requires org context)
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
    
    // Get organization ID from request headers
    let organizationId = request.headers.get('x-organization-id');
    
    // If there's no organization ID in headers but it's required, try to get from API
    if (!organizationId && (options.requireOrg || options.allowedRoles)) {
      try {
        // Call backend to get user's active organization
        const orgResponse = await fetch(`${API_BASE_URL}/users/context`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!orgResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch user context' },
            { status: 500 }
          );
        }
        
        const orgData = await orgResponse.json();
        organizationId = orgData.orgId;
        
        // If organization is still not found but required
        if (!organizationId && options.requireOrg) {
          return NextResponse.json(
            { error: 'No active organization' },
            { status: 400 }
          );
        }
        
        // Check role restrictions if specified
        if (options.allowedRoles && options.allowedRoles.length > 0) {
          if (!orgData.orgRole || !options.allowedRoles.includes(orgData.orgRole)) {
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }
      } catch (error) {
        console.error('Error fetching organization context:', error);
        return NextResponse.json(
          { error: 'Failed to fetch organization context' },
          { status: 500 }
        );
      }
    }
    
    // Call the handler with authentication and organization context
    return await handler(session, organizationId, request);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 