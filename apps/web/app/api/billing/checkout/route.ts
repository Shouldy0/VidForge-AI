import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createRouteHandlerClient } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { priceId } = await request.json()

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    // Get user from auth
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Check if user already has a stripe customer
    const { data: existingCustomer } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    let customerId: string

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          user_id: userId
        }
      })
      customerId = customer.id
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/settings/billing?canceled=true`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
