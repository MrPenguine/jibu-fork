import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const provider = formData.get('provider') as string

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${request.nextUrl.origin}/api/auth/callback`,
      }
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: data.url })
  } catch (error) {
    console.error('OAuth error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 