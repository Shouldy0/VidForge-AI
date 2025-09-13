import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishRequest {
  episode_id: string
  title: string
  description: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body: PublishRequest = await req.json()

    // Validate required fields
    if (!body.episode_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: episode_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from episode
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select(`
        id,
        title,
        series (
          brand_id,
          brands (
            user_id
          )
        )
      `)
      .eq('id', body.episode_id)
      .single()

    if (episodeError || !episode) {
      throw new Error(`Episode not found: ${episodeError?.message}`)
    }

    const userId = episode.series?.brands?.user_id
    if (!userId) {
      throw new Error('User ID not found for episode')
    }

    // Check rate limit - Instagram allows 30 posts per 24 hours for business accounts
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)

    const { count: recentPosts, error: countError } = await supabase
      .from('analytics')
      .select('*', { count: 'exact' })
      .eq('platform', 'instagram')
      .gte('created_at', yesterday.toISOString())

    if (countError) {
      console.error('Error checking rate limit:', countError)
    } else if (recentPosts && recentPosts >= 25) { // Conservative limit below 30
      throw new Error('Rate limit exceeded: 25 Instagram posts per 24 hours')
    }

    // Get Instagram OAuth tokens from social_accounts
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('oauth')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .single()

    if (accountError || !socialAccount?.oauth) {
      throw new Error('Instagram account not connected. Please connect Instagram in settings.')
    }

    const { access_token, account_id } = socialAccount.oauth as any

    // Get render URL
    const { data: render, error: renderError } = await supabase
      .from('renders')
      .select('url')
      .eq('episode_id', body.episode_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (renderError || !render || !render.url) {
      throw new Error(`No completed render found for episode: ${renderError?.message}`)
    }

    // Download video
    const videoResponse = await fetch(render.url)
    if (!videoResponse.ok) {
      throw new Error('Failed to download video file')
    }

    const videoBuffer = await videoResponse.arrayBuffer()

    // Upload to Instagram (Feed or IGTV)
    const postId = await uploadToInstagram(access_token, account_id, videoBuffer, body.title || episode.title, body.description)

    // Store in analytics
    const { error: analyticsError } = await supabase
      .from('analytics')
      .insert({
        episode_id: body.episode_id,
        platform: 'instagram',
        video_id: postId,
        collected_at: new Date().toISOString().split('T')[0],
      })

    if (analyticsError) {
      console.error('Failed to save to analytics:', analyticsError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        postId,
        url: `https://www.instagram.com/p/${postId}/`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Instagram publish error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to publish to Instagram',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Instagram upload function (placeholder - requires Facebook Graph API approval)
async function uploadToInstagram(accessToken: string, accountId: string, videoBuffer: ArrayBuffer, title: string, description: string): Promise<string> {
  // This is a placeholder for Instagram video upload
  // For Feed videos: https://developers.facebook.com/docs/instagram-api/guides/content-publishing#feed-videos
  // For IGTV videos: https://developers.facebook.com/docs/instagram-api/guides/content-publishing#igtv-videos

  // Placeholder return - replace with actual API call
  return `instagram_post_${Date.now()}`
}
