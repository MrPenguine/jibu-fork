import { NextResponse, type NextRequest } from 'next/server'
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/api') || path.startsWith('/_next')) {
    return NextResponse.next()
  }

  const backendUrl = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/api\/?$/, '')
  const sessionResponse = await fetch(`${backendUrl}/api/auth/get-session`, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  })
  const session = sessionResponse.ok ? await sessionResponse.json() : null
  const user = session?.user
  const isPublicAuthPage = path === '/login' || path === '/signup' || path === '/login/error'
  const isAuthEntryPage = path === '/' || path === '/login' || path === '/signup'
  if (user && isAuthEntryPage) {
    const contextResponse = await fetch(`${backendUrl}/api/users/context`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    })
    if (contextResponse.ok) {
      const context = await contextResponse.json()
      const target = context.user?.isAdmin || context.isAdmin
        ? '/admin'
        : context.workspaceId
          ? `/workspace/${context.workspaceId}`
          : '/login/error?reason=workspace-resolution'
      return NextResponse.redirect(new URL(target, request.url))
    }
    return NextResponse.redirect(new URL('/login/error?reason=workspace-resolution', request.url))
  }
  if (!user && !isPublicAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}