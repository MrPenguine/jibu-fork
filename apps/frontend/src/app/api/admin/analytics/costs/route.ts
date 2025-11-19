import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../utils/api';
import { createClient } from '../../../../../utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const incomingUrl = new URL(req.url);
    const days = incomingUrl.searchParams.get('days');

    const url = new URL(`${API_BASE_URL}/admin/analytics/costs`);
    if (days) url.searchParams.set('days', days);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        // ignore
      }

      return NextResponse.json(
        {
          error:
            errorBody?.message || 'Failed to fetch cost analytics from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin cost analytics proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost analytics' },
      { status: 500 },
    );
  }
}
