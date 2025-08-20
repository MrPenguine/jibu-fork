import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndWorkspace } from '../../../utils/apiRouteProtection';

export async function GET(request: NextRequest) {
  return withAuthAndWorkspace(
    request,
    async (session, workspaceId, request) => {
      // Your protected route logic here
      return NextResponse.json({
        message: 'Hello, from protected API!',
        authenticated: true,
        workspaceId: workspaceId || 'No workspace specified',
        userEmail: session.user?.email
      });
    },
    { requireWorkspace: false } // Workspace is not required for this route
  );
}
