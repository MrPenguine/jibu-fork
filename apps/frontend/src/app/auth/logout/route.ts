import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '../../../utils/supabase/server'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = await createClient()
  
  await supabase.auth.signOut()
  
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 302
  })
} 