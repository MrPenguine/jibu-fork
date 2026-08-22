import { cookies } from 'next/headers'

const backendUrl = () =>
  (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
    .replace(/\/api\/?$/, '')

export async function getSession() {
  const cookieHeader = (await cookies()).toString()
  const response = await fetch(`${backendUrl()}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json()
}

export async function getSessionHeaders(): Promise<Record<string, string>> {
  const cookieHeader = (await cookies()).toString()
  return { cookie: cookieHeader }
}

export async function createClient() {
  const session = await getSession()
  const compatibleSession = session?.session
    ? { ...session.session, user: session.user }
    : null
  return {
    auth: {
      async getSession() {
        return { data: { session: compatibleSession }, error: null }
      },
      async getUser() {
        return { data: { user: session?.user ?? null }, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
  }
}
