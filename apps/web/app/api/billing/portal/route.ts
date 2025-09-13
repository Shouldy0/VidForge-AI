import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createRouteHandlerClient } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function GET(request: NextRequest) {
  try {
    // Get user from auth
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get stripe customer ID
    const { data: customerRecord } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (!customerRecord?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerRecord.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/settings/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error: any) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
