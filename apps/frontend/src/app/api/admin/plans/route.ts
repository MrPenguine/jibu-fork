import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../utils/api';
import { createClient, getSessionHeaders } from '../../../../utils/auth/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_BASE_URL}/admin/plans`, {
      method: 'GET',
      headers: {
        ...(await getSessionHeaders()),
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
            'Failed to fetch plans from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin plans list proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
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

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const response = await fetch(`${API_BASE_URL}/admin/plans`, {
      method: 'POST',
      headers: {
        ...(await getSessionHeaders()),
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
            'Failed to create plan on backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Admin plans create proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 },
    );
  }
}
