import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createRouteHandlerClient } from '@/lib/supabase'
import type { Database } from 'packages/shared/src/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const body = await request.text()
  const sig = headers().get('stripe-signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message)
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        const subscription = event.data.object as Stripe.Subscription
        const customer = await stripe.customers.retrieve(subscription.customer as string)

        // Get the price to determine plan
        const price = subscription.items.data[0]?.price
        const plan = price?.id ? 'premium' : 'free' // You can customize this based on your price IDs

        await supabase
          .from('subscriptions')
          .insert({
            user_id: customer.metadata.user_id,
            stripe_customer_id: customer.id,
            stripe_price_id: price?.id || null,
            plan: plan,
            renew_at: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
          })

        break

      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object as Stripe.Subscription
        const updatedPrice = updatedSubscription.items.data[0]?.price
        const updatedPlan = updatedPrice?.id ? 'premium' : 'free'

        await supabase
          .from('subscriptions')
          .update({
            stripe_price_id: updatedPrice?.id || null,
            plan: updatedPlan,
            renew_at: updatedSubscription.current_period_end ? new Date(updatedSubscription.current_period_end * 1000) : null,
          })
          .eq('stripe_customer_id', updatedSubscription.customer as string)

        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription

        await supabase
          .from('subscriptions')
          .update({
            plan: 'canceled',
            renew_at: null,
          })
          .eq('stripe_customer_id', deletedSubscription.customer as string)

        break

      case 'invoice.payment_succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', event.data.object.id)
        break

      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object.id)
        break

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stripe webhook endpoint' })
}
