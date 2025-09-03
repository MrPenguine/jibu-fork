import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { API_BASE_URL } from '../../../../utils/api'

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient()
    
    // Get current session (token) and ensure authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Call backend API to get user's last workspace or default workspace
    try {
      const response = await fetch(`${API_BASE_URL}/users/last-workspace`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workspace: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Error fetching last workspace:', error)
      return NextResponse.json(
        { error: 'Failed to fetch workspace' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in get-user-workspace (compat route):', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}