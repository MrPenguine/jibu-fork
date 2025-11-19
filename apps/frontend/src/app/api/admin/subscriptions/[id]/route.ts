import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../utils/api';
import { createClient } from '../../../../../utils/supabase/server';

async function withAuth() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      session: null as any,
      errorResponse: NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      ),
    };
  }

  return { session, errorResponse: null };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { session, errorResponse } = await withAuth();
    if (!session) return errorResponse!;

    const { id } = params;

    const response = await fetch(`${API_BASE_URL}/admin/subscriptions/${id}`, {
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
            errorBody?.message || 'Failed to fetch subscription from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin subscription detail proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { session, errorResponse } = await withAuth();
    if (!session) return errorResponse!;

    const { id } = params;
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const response = await fetch(`${API_BASE_URL}/admin/subscriptions/${id}`, {
      method: 'PATCH',
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
            errorBody?.message || 'Failed to update subscription on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin subscription update proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { session, errorResponse } = await withAuth();
    if (!session) return errorResponse!;

    const { id } = params;

    const response = await fetch(`${API_BASE_URL}/admin/subscriptions/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
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
            errorBody?.message || 'Failed to cancel subscription on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin subscription cancel proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 },
    );
  }
}
