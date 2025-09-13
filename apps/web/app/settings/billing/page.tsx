import { requireUser } from '../../lib/supabase'
import { createServerComponentClient } from '../../lib/supabase'

async function getUserData(userId: string) {
  const supabase = createServerComponentClient()

  // Get subscriptions
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)

  // Get credit balance (sum of delta from credit_ledger)
  const { data: creditLedger } = await supabase
    .from('credit_ledger')
    .select('delta')
    .eq('user_id', userId)

  const creditBalance = creditLedger?.reduce((sum: number, entry: any) => sum + entry.delta, 0) || 0

  return {
    subscriptions: subscriptions || [],
    creditBalance
  }
}

export default async function BillingPage() {
  const profile = await requireUser()
  const { subscriptions, creditBalance } = await getUserData(profile.id)

  const urlParams = new URLSearchParams() // We can't access searchParams in Server Component easily
  // For demo, we'll use client component for URL params

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>

      {/* Status Messages */}
      <div className="mb-6">
        {/* We'll handle success/cancel messages with client component */}
        < div className="hidden" id="success-message">
          <div className="alert alert-success">Subscription created successfully!</div>
        </div>
        <div className="hidden" id="cancel-message">
          <div className="alert alert-warning">Subscription was canceled.</div>
        </div>
      </div>

      {/* Current Subscription */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Current Subscription</h2>

          {subscriptions.length > 0 ? (
            subscriptions.map((sub: any) => (
              <div key={sub.id} className="mt-4">
                <p><strong>Plan:</strong> {sub.plan}</p>
                <p><strong>Status:</strong>
                  <span className={`badge ${sub.plan === 'premium' ? 'badge-primary' : 'badge-neutral'} ml-2`}>
                    {sub.plan}
                  </span>
                </p>
                <p><strong>Renews:</strong> {sub.renew_at ? new Date(sub.renew_at).toLocaleDateString() : 'N/A'}</p>

                {sub.stripe_customer_id && (
                  <button
                    className="btn btn-outline btn-sm mt-2"
                    onClick={() => window.location.href = '/api/billing/portal'}
                  >
                    Manage Subscription
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No active subscription</p>
          )}

          {!subscriptions.some((s: any) => s.plan === 'premium') && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Upgrade to Premium</h3>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const priceId = prompt('Enter Stripe Price ID for checkout:')
                  if (priceId) {
                    fetch('/api/billing/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ priceId })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.url) window.location.href = data.url
                    })
                  }
                }}
              >
                Upgrade Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Credit Balance */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Credit Balance</h2>
          <p className="text-2xl font-bold">{creditBalance} credits</p>
          <p className="text-sm text-gray-600">Available for video generation and processing</p>
        </div>
      </div>
    </div>
  )
}
