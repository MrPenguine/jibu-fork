import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../utils/api';
import { createClient } from '../../../../utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const incomingUrl = new URL(req.url);
    const page = incomingUrl.searchParams.get('page');
    const pageSize = incomingUrl.searchParams.get('pageSize');
    const search = incomingUrl.searchParams.get('search');

    const url = new URL(`${API_BASE_URL}/admin/users`);
    if (page) url.searchParams.set('page', page);
    if (pageSize) url.searchParams.set('pageSize', pageSize);
    if (search) url.searchParams.set('search', search);

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
            errorBody?.message ||
            'Failed to fetch users from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin users proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 },
    );
  }
}
