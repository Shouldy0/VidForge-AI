import { createClient } from '@/lib/supabase'
import { NextResponse, NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Get authenticated user
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.user.id

    // Resolve code to referrer_id
    const { data: resolveData, error: resolveError } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', code)
      .single()

    if (resolveError || !resolveData) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }

    const referrerId = resolveData.user_id

    // Check if referrer_id == user_id (self-referral)
    if (referrerId === userId) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Check if user already has a referrer
    const { data: profile } = await supabase
      .from('profiles')
      .select('referrer_id')
      .eq('id', userId)
      .single()

    if (profile?.referrer_id) {
      return NextResponse.json({ error: 'Referrer already set' }, { status: 400 })
    }

    // Update profile with referrer_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referrer_id: referrerId })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to set referrer' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting referrer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
