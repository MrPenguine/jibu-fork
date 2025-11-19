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
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const incomingUrl = new URL(req.url);
    const page = incomingUrl.searchParams.get('page');
    const pageSize = incomingUrl.searchParams.get('pageSize');
    const status = incomingUrl.searchParams.get('status');
    const planId = incomingUrl.searchParams.get('planId');
    const search = incomingUrl.searchParams.get('search');

    const url = new URL(`${API_BASE_URL}/admin/subscriptions`);
    if (page) url.searchParams.set('page', page);
    if (pageSize) url.searchParams.set('pageSize', pageSize);
    if (status) url.searchParams.set('status', status);
    if (planId) url.searchParams.set('planId', planId);
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
            errorBody?.message || 'Failed to fetch subscriptions from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin subscriptions list proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const response = await fetch(`${API_BASE_URL}/admin/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
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
            errorBody?.message || 'Failed to create subscription on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Admin subscriptions create proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 },
    );
  }
}
