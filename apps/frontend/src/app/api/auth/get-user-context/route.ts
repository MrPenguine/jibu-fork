import { NextRequest, NextResponse } from 'next/server'

const backendUrl = () =>
  (process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000').replace(/\/api\/?$/, '')

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') || ''
  const headers = { cookie }

  const sessionResponse = await fetch(`${backendUrl()}/api/auth/get-session`, {
    headers,
    cache: 'no-store',
  })
  const session = sessionResponse.ok ? await sessionResponse.json() : null

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const contextResponse = await fetch(`${backendUrl()}/api/users/context`, {
    headers,
    cache: 'no-store',
  })
  const body = await contextResponse.text()

  return new NextResponse(body, {
    status: contextResponse.status,
    headers: { 'content-type': 'application/json' },
  })
}
