import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../utils/api';
import { createClient } from '../../../../../utils/supabase/server';

async function withAuth() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { session: null, errorResponse: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
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

    const response = await fetch(`${API_BASE_URL}/admin/plans/${id}`, {
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
            'Failed to fetch plan from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin plan detail proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
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

    const response = await fetch(`${API_BASE_URL}/admin/plans/${id}`, {
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
            errorBody?.message ||
            'Failed to update plan on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin plan update proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
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

    const response = await fetch(`${API_BASE_URL}/admin/plans/${id}`, {
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
            errorBody?.message ||
            'Failed to deactivate plan on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin plan deactivate proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate plan' },
      { status: 500 },
    );
  }
}
