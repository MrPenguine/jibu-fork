import { NextResponse } from 'next/server';

// Container liveness check — deliberately has no auth/backend dependency,
// so a transient upstream outage doesn't flap the container's health state.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
