import { createAuthClient } from 'better-auth/react'

const authBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')}/api/auth`
  : typeof window === 'undefined'
    ? 'http://localhost:3000/api/auth'
    : '/api/auth'

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
})
