import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Skip middleware for callback routes to prevent redirect loops
  // This ensures the OAuth callback can complete without interruption
  if (request.nextUrl.pathname.startsWith('/api/auth/callback')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get the pathname from the URL
  const path = request.nextUrl.pathname

  const isAdminPath = path === '/admin' || path.startsWith('/admin/')

  if (isAdminPath && user) {
    const apiUrl = new URL('/api/auth/get-user-context', request.nextUrl)
    try {
      const wsResp = await fetch(apiUrl.toString(), {
        headers: { cookie: request.headers.get('cookie') ?? '' },
      })
      if (wsResp.ok) {
        const data = await wsResp.json()
        const isPlatformAdmin = Boolean(
          data?.isPlatformAdmin ??
          data?.isAdmin ??
          data?.user?.isPlatformAdmin ??
          data?.user?.isAdmin ??
          false
        )
        if (!isPlatformAdmin) {
          const redirectUrl = request.nextUrl.clone()
          redirectUrl.pathname = '/workspaces'
          return NextResponse.redirect(redirectUrl)
        }
      }
    } catch (_) {}
  }

  // Legacy redirects for removed /auth routes
  if (path === '/auth' || path === '/auth/') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }
  if (path.startsWith('/auth/error')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login/error'
    return NextResponse.redirect(redirectUrl)
  }
  if (path.startsWith('/auth/logout')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/logout'
    return NextResponse.redirect(redirectUrl)
  }

  // If no user is signed in and the request is not for a public route, redirect
  if (
    !user &&
    // Allow access to API routes
    !path.startsWith('/api') &&
    // Allow access to static assets and Next.js routes
    !path.startsWith('/_next') &&
    !path.startsWith('/_vercel') &&
    // Allow access to login and signup routes
    !path.startsWith('/login') &&
    !path.startsWith('/signup') &&
    // Check if it's a protected path - either root or any path not explicitly public
    (path === '/' || (!path.includes('.') && path !== '/'))
  ) {
    // Redirect to login
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  // If user is signed in and they're trying to access the login or signup page, redirect to workspace
  if (
    user &&
    (path === '/' || path === '/login' || path === '/signup')
  ) {
    const redirectUrl = request.nextUrl.clone()
    try {
      const apiUrl = new URL('/api/auth/get-user-context', request.nextUrl)
      const wsResp = await fetch(apiUrl.toString(), {
        // Forward cookies so the internal API sees the session
        headers: { cookie: request.headers.get('cookie') ?? '' },
      })
      if (wsResp.ok) {
        const data = await wsResp.json()
        const isPlatformAdmin = Boolean(
          data?.isPlatformAdmin ??
          data?.isAdmin ??
          data?.user?.isPlatformAdmin ??
          data?.user?.isAdmin ??
          false
        )
        if (isPlatformAdmin) {
          redirectUrl.pathname = '/admin'
          return NextResponse.redirect(redirectUrl)
        }
        // Be flexible with response shapes
        const workspaceId =
          data?.workspace?.id ||
          data?.activeWorkspace?.id ||
          data?.lastWorkspace?.id ||
          data?.workspaceId
        if (workspaceId) {
          redirectUrl.pathname = `/workspace/${workspaceId}`
          return NextResponse.redirect(redirectUrl)
        }
      }
    } catch (_) {
      // ignore and fallback below
    }
    // Standard fallback if we can't resolve a workspace
    redirectUrl.pathname = '/workspaces'
    return NextResponse.redirect(redirectUrl)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}