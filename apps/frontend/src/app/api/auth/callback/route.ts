import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { API_BASE_URL } from '../../../../utils/api'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const { searchParams, origin } = url
  const host = url.host
  const isAdminHost = host.includes('3005') || host.startsWith('admin.')
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login/error`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  
  if (error) {
    return NextResponse.redirect(`${origin}/login/error`)
  }

  // Try to resolve user's last organization and redirect to workspace
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (accessToken) {
      const resp = await fetch(`${API_BASE_URL}/users/last-organization`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      if (resp.ok) {
        const data = await resp.json()
        const workspaceId = data?.organization?.id
        if (workspaceId) {
          if (isAdminHost) {
            return NextResponse.redirect(`${origin}/`)
          }
          return NextResponse.redirect(`${origin}/workspace/${workspaceId}`)
        }
      }
    }
  } catch (e) {
    // ignore and fallback to next
    console.error('OAuth post-login org resolution failed:', e)
  }

  return NextResponse.redirect(`${origin}${next}`)
}