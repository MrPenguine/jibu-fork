import { createAuthClient } from 'better-auth/react'

const authBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')}/api/auth`
  : typeof window === 'undefined'
    ? 'http://localhost:3000/api/auth'
    : '/api/auth'

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
})

type SessionResult = Awaited<ReturnType<typeof authClient.getSession>>

export function createClient() {
  return {
    auth: {
      async getSession() {
        const result = await authClient.getSession()
        return {
          data: {
              session: result.data?.session
                ? {
                  ...result.data.session,
                  user: result.data.user,
                }
                : null,
          },
          error: result.error,
        }
      },
      async getUser() {
        const result = await authClient.getSession()
        return {
          data: { user: result.data?.user ?? null },
          error: result.error,
        }
      },
      async signOut() {
        return authClient.signOut()
      },
      onAuthStateChange(callback: (event: string, session: SessionResult['data']) => void) {
        void callback
        return {
          data: {
            subscription: {
              unsubscribe() {
                return undefined
              },
            },
          },
        }
      },
    },
  }
}
