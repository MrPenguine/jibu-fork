'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authClient } from './client'

const getBaseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { error } = await authClient.signIn.email({ email, password })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { data, error } = await authClient.signUp.email({ email, password, name: email })

  if (error) {
    return { error: error.message }
  }

  return data?.token
    ? { success: true, message: 'Account created successfully' }
    : { success: true, message: 'Check your email for the confirmation link' }
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required' }
  }

  const response = await fetch(`${getBaseUrl()}/api/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, redirectTo: `${getBaseUrl()}/reset-password` }),
  })
  if (!response.ok) return { error: 'Unable to send password reset email' }

  return { success: true, message: 'Check your email for the reset link' }
}

export async function signInWithGoogle() {
  const { data, error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL: `${getBaseUrl()}/`,
  })

  if (error) {
    return { error: error.message }
  }

  return { url: data.url }
}

export async function logout(formData: FormData) {
  const { error } = await authClient.signOut()
  
  if (error) {
    console.error("Logout error:", error.message)
  }
  
  revalidatePath('/', 'layout')
  redirect('/login')
}
