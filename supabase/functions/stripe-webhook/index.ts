import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

interface WebhookEvent {
  id: string
  object: 'event'
  api_version: string
  created: number
  data: {
    object: any
    previous_attributes?: any
  }
  livemode: boolean
  pending_webhooks: number
  request: {
    id?: string
    idempotency_key?: string
  }
  type: string
}

async function upsertSubscription(user_id: string, subscription: Stripe.Subscription) {
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id, plan')
    .eq('user_id', user_id)
    .single()

  let plan = 'monthly' // default
  if (subscription.items.data[0]?.price.id) {
    plan = subscription.items.data[0].price.id.includes('yearly') ? 'yearly' : 'monthly'
  }

  const renew_at = new Date(subscription.current_period_end * 1000).toISOString()

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id,
      stripe_customer_id: subscription.customer,
      stripe_price_id: subscription.items.data[0]?.price.id || '',
      plan,
      renew_at,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('Error upserting subscription:', error)
    throw error
  }

  const isNewSubscription = !existingSub
  const isPlanUpgrade = existingSub && existingSub.plan !== plan

  // Add monthly credits if new subscription or if upgrading plans
  if (isNewSubscription || isPlanUpgrade) {
    const creditAmount = plan === 'yearly' ? 120 : 10 // 12 months of 10 credits for yearly, 10 for monthly

    await supabase
      .from('credit_ledger')
      .insert({
        user_id,
        delta: creditAmount,
        reason: 'subscription',
        created_at: new Date().toISOString(),
      })

    // Emit notification
    await supabase.rpc('notify_credits_updated', { user_id })
  }

  // Award referral credits if this is a new subscription
  if (isNewSubscription) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referrer_id')
      .eq('id', user_id)
      .single()

    if (profile?.referrer_id) {
      // Check if referral award already exists for this referred user
      const { data: existingAward } = await supabase
        .from('referral_awards')
        .select('id')
        .eq('referred_id', user_id)
        .single()

      if (!existingAward) {
        // Insert referral award
        await supabase
          .from('referral_awards')
          .insert({
            referrer_id: profile.referrer_id,
            referred_id: user_id,
            awarded_at: new Date().toISOString(),
          })

        // Award credits to referrer
        await supabase
          .from('credit_ledger')
          .insert({
            user_id: profile.referrer_id,
            delta: 100,
            reason: 'referral_bonus',
            created_at: new Date().toISOString(),
          })

        // Notify referrer of credit update
        await notifyCreditsUpdated(profile.referrer_id)
      }
    }
  }

  return { isNewSubscription, isPlanUpgrade }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string)
  const user_id = (customer as any).metadata.user_id

  if (!user_id) {
    console.error('No user_id in customer metadata')
    return
  }

  await upsertSubscription(user_id, subscription)
}

async function handleCheckoutSessionCompleted(checkoutSession: Stripe.Checkout.Session) {
  const customer = await stripe.customers.retrieve(checkoutSession.customer as string)
  const user_id = (customer as any).metadata.user_id

  if (!user_id) {
    console.error('No user_id in customer metadata')
    return
  }

  // The subscription will be updated via the subscription.updated event
  // This is mainly for one-time payments if any
  console.log('Checkout session completed:', checkoutSession.id)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer as string)
  const user_id = (customer as any).metadata.user_id

  if (!user_id) {
    console.error('No user_id in customer metadata')
    return
  }

  // Add recurring monthly credits on successful payment
  const creditAmount = 10 // 10 credits per month

  await supabase
    .from('credit_ledger')
    .insert({
      user_id,
      delta: creditAmount,
      reason: 'monthly_renewal',
      created_at: new Date().toISOString(),
    })

  // Emit notification
  await supabase.rpc('notify_credits_updated', { user_id })

  console.log('Invoice paid:', invoice.id)
}

async function notifyCreditsUpdated(userId: string) {
  await supabase.rpc('notify_credits_updated', { user_id: userId })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  let event: WebhookEvent

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret) as WebhookEvent
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
