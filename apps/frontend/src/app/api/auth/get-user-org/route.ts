import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { API_BASE_URL } from '../../../../utils/api'

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Call backend API to get user's last organization or default organization
    try {
      const response = await fetch(`${API_BASE_URL}/users/last-organization`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await supabase.auth.getSession().then(res => res.data.session?.access_token)}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organization: ${response.statusText}`)
      }
      
      const data = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching last organization:', error)
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in get-user-org:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 