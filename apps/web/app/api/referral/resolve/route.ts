import { createClient } from '@/lib/supabase'
import { NextResponse, NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Find user by referral code
    const { data, error } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', code)
      .single()

    if (error || !data) {
      return NextResponse.json({ referrer_id: null })
    }

    return NextResponse.json({ referrer_id: data.user_id })
  } catch (error) {
    console.error('Error resolving referral code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
