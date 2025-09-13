import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Environment variables (ensure these are set)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function middleware(req: NextRequest) {
  // Check if request is to Gemini-related API (adjust path as needed for your app)
  if (req.nextUrl.pathname.startsWith('/api/gemini')) {
    const res = NextResponse.next()

    const supabase = createServerClient({
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY,
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    })

    // Get authenticated user
    const { data: { user }, error } = await supabase.auth.getUser()

    if (!user || error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Call can_call RPC for rate limiting
    const { data, error: rpcError } = await supabase.rpc('can_call', {
      user_id_param: user.id,
      route_param: req.nextUrl.pathname, // Use pathname as route identifier
      per_minute_param: 10 // Example: 10 calls per minute; adjust based on your limits
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!data) {
      // Rate limit exceeded
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If allowed, continue to the API route
    return res
  }

  // For other requests, continue normally
  return NextResponse.next()
}

// Configure which paths the middleware runs on (optional: default is all)
export const config = {
  matcher: '/api/:path*'
}
