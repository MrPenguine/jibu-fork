import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../../utils/api';
import { createClient, getSessionHeaders } from '../../../../../../utils/auth/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const body = await req.json().catch(() => ({}));
    const response = await fetch(`${API_BASE_URL}/admin/users/${params.id}/role`, {
      method: 'PATCH',
      headers: {
        ...(await getSessionHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorBody?.message || 'Failed to update user role',
        },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Admin user role proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 },
    );
  }
}
