import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndOrg } from '../../../utils/apiRouteProtection';
import { API_BASE_URL } from '../../../utils/api';

export async function GET(request: NextRequest) {
  return withAuthAndOrg(
    request,
    async (session, organizationId, request) => {
      // This route will only execute if user has 'admin' or 'owner' role
      return NextResponse.json({
        message: 'Welcome to the admin area!',
        organizationId,
        userEmail: session.user?.email,
        timestamp: new Date().toISOString()
      });
    },
    { 
      requireOrg: true, // Organization is required for this route
      allowedRoles: ['admin', 'owner'] // Only these roles can access
    }
  );
}

export async function POST(request: NextRequest) {
  return withAuthAndOrg(
    request,
    async (session, organizationId, request) => {
      try {
        // Parse the request body
        const requestData = await request.json();
        
        // Forward the request to the backend API with auth and org context
        const response = await fetch(`${API_BASE_URL}/admin/settings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'X-Organization-ID': organizationId || '',
          },
          body: JSON.stringify(requestData),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: errorData.message || 'Backend request failed' },
            { status: response.status }
          );
        }
        
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        console.error('Error in admin POST:', error);
        return NextResponse.json(
          { error: 'Failed to process request' },
          { status: 500 }
        );
      }
    },
    { 
      requireOrg: true,
      allowedRoles: ['admin', 'owner']
    }
  );
} 