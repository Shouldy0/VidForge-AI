import { createClient } from '@/lib/supabase'
import { NextResponse, NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.user.id

    // Check if user already has a referral code
    const { data: existingCode } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .single()

    if (existingCode) {
      return NextResponse.json({ code: existingCode.code })
    }

    // Generate new code
    const { data: code, error: rpcError } = await supabase.rpc('generate_unique_referral_code')

    if (rpcError || !code) {
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    // Insert new code
    const { error: insertError } = await supabase
      .from('referral_codes')
      .insert({ user_id: userId, code })

    if (insertError) {
      return NextResponse.json({ error: 'Failed to save code' }, { status: 500 })
    }

    return NextResponse.json({ code })
  } catch (error) {
    console.error('Error generating referral code:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
