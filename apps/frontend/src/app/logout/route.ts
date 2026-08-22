import { NextRequest, NextResponse } from 'next/server'

async function handleLogout(request: NextRequest) {
  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/api\/?$/, '')
  const response = await fetch(`${backendUrl}/api/auth/sign-out`, {
    method: 'POST',
    headers: {
      cookie: request.headers.get('cookie') || '',
      origin: request.nextUrl.origin,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  const redirectResponse = NextResponse.redirect(new URL('/login', request.url), {
    status: 302
  })
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    redirectResponse.headers.append('set-cookie', cookie)
  }
  return redirectResponse
}

export const POST = handleLogout
export const GET = handleLogout
