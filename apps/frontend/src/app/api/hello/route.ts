import { NextRequest, NextResponse } from 'next/server';
import { withAuthAndOrg } from '../../../utils/apiRouteProtection';

export async function GET(request: NextRequest) {
  return withAuthAndOrg(
    request,
    async (session, organizationId, request) => {
      // Your protected route logic here
      return NextResponse.json({
        message: 'Hello, from protected API!',
        authenticated: true,
        organizationId: organizationId || 'No organization specified',
        userEmail: session.user?.email
      });
    },
    { requireOrg: false } // Organization is not required for this route
  );
}
