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

    // Check rate limit - TikTok allows ~10 videos per hour, 100 per day
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)

    const { count: recentPosts, error: countError } = await supabase
      .from('analytics')
      .select('*', { count: 'exact' })
      .eq('episode_id', body.episode_id)
      .eq('platform', 'tiktok')
      .gte('created_at', yesterday.toISOString())

    if (countError) {
      console.error('Error checking rate limit:', countError)
    } else if (recentPosts && recentPosts >= 10) { // Conservative limit
      throw new Error('Rate limit exceeded: 10 TikTok posts per 24 hours')
    }

    // Get TikTok OAuth tokens from social_accounts
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('oauth')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .single()

    if (accountError || !socialAccount?.oauth) {
      throw new Error('TikTok account not connected. Please connect TikTok in settings.')
    }

    const { access_token, open_id } = socialAccount.oauth as any

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

    // Get access token if expired (placeholder)
    // TikTok tokens expire in 24 hours, so you may need to refresh

    // Upload to TikTok
    const videoId = await uploadToTikTok(access_token, open_id, videoBuffer, body.title || episode.title, body.description)

    // Store in analytics
    const { error: analyticsError } = await supabase
      .from('analytics')
      .insert({
        episode_id: body.episode_id,
        platform: 'tiktok',
        video_id: videoId,
        collected_at: new Date().toISOString().split('T')[0],
      })

    if (analyticsError) {
      console.error('Failed to save to analytics:', analyticsError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        url: `https://www.tiktok.com/@${open_id}/video/${videoId}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('TikTok publish error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to publish to TikTok',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// TikTok upload function (placeholder - requires TikTok API approval)
async function uploadToTikTok(accessToken: string, openId: string, videoBuffer: ArrayBuffer, title: string, description: string): Promise<string> {
  // This is a placeholder for TikTok video upload
  // Actual implementation requires TikTok Content Posting API approval
  // https://developers.tiktok.com/doc/content-posting-api-reference-direct-item-post/

  // Placeholder return - replace with actual API call
  return `tiktok_video_${Date.now()}`
}
