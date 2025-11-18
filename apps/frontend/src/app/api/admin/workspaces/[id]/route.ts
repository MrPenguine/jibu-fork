import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../../utils/api';
import { createClient } from '../../../../../utils/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const { id } = params;

    const response = await fetch(`${API_BASE_URL}/admin/workspaces/${id}`, {
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
            'Failed to fetch workspace from backend',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin workspace detail proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace' },
      { status: 500 },
    );
  }
}
