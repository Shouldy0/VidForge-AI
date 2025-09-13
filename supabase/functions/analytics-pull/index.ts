import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all analytics records with video_ids for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: analyticsRecords, error: fetchError } = await supabase
      .from('analytics')
      .select(`
        id,
        episode_id,
        platform,
        video_id,
        views,
        retention03,
        completion_pct,
        ctr_thumb,
        collected_at,
        episodes (
          series (
            brand_id,
            brands (
              user_id
            )
          )
        )
      `)
      .not('video_id', 'is', null)
      .gte('collected_at', sevenDaysAgo.toISOString().split('T')[0])
      .order('platform')

    if (fetchError) {
      throw new Error(`Failed to fetch analytics records: ${fetchError.message}`)
    }

    console.log(`Found ${analyticsRecords?.length || 0} analytics records to process`)

    let processed = 0
    let errors = 0

    // Group by platform and user for efficient API calls
    const byPlatformAndUser = analyticsRecords?.reduce((acc, record) => {
      const platform = record.platform
      const userId = record.episodes?.series?.brands?.user_id

      if (!platform || !userId || !record.video_id) return acc

      if (!acc[platform]) acc[platform] = {}
      if (!acc[platform][userId]) acc[platform][userId] = []

      acc[platform][userId].push(record)
      return acc
    }, {}) || {}

    // Process each platform
    for (const [platform, users] of Object.entries(byPlatformAndUser)) {
      for (const [userId, records] of Object.entries(users)) {
        try {
          // Get social account credentials for this user
          const { data: socialAccount, error: accountError } = await supabase
            .from('social_accounts')
            .select('oauth')
            .eq('user_id', userId)
            .eq('platform', platform)
            .single()

          if (accountError || !socialAccount?.oauth) {
            console.error(`No ${platform} credentials for user ${userId}`)
            errors += records.length
            continue
          }

          // Pull stats based on platform
          const statsData = await pullPlatformStats(platform, socialAccount.oauth, records)

          // Upsert the updated analytics data
          for (const stat of statsData) {
            const { error: upsertError } = await supabase
              .from('analytics')
              .upsert(stat, {
                onConflict: 'episode_id,platform,collected_at'
              })

            if (upsertError) {
              console.error(`Failed to upsert analytics for ${stat.episode_id}:`, upsertError)
              errors++
            } else {
              processed++
            }
          }

        } catch (error) {
          console.error(`Error processing ${platform} stats for user ${userId}:`, error)
          errors += records.length
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: analyticsRecords?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Analytics pull error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to pull analytics',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Pull stats from specific platform APIs
async function pullPlatformStats(platform: string, oauth: any, records: any[]): Promise<any[]> {
  switch (platform.toLowerCase()) {
    case 'youtube':
      return await pullYouTubeStats(oauth, records)
    case 'tiktok':
      return await pullTikTokStats(oauth, records)
    case 'instagram':
      return await pullInstagramStats(oauth, records)
    default:
      console.warn(`Unsupported platform: ${platform}`)
      return []
  }
}

// YouTube Analytics API
async function pullYouTubeStats(oauth: any, records: any[]): Promise<any[]> {
  const { access_token } = oauth
  const today = new Date().toISOString().split('T')[0]
  const updatedRecords = []

  // Get access token if expired
  const validToken = await getYouTubeAccessToken(access_token, oauth)

  // Batch process videos for analytics
  const videoIds = records.map(r => r.video_id).filter(id => id).slice(0, 50) // YouTube limits

  if (videoIds.length === 0) return []

  try {
    // Get video statistics
    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!statsResponse.ok) {
      throw new Error(`YouTube API error: ${statsResponse.status}`)
    }

    const statsData = await statsResponse.json()
    const statsMap = new Map()
    statsData.items?.forEach((item: any) => {
      statsMap.set(item.id, item.statistics || {})
    })

    // Process each record
    for (const record of records) {
      const videoStats = statsMap.get(record.video_id)
      if (videoStats) {
        const updated = {
          ...record,
          views: parseInt(videoStats.viewCount || '0'),
          likes: parseInt(videoStats.likeCount || '0'),
          comments: parseInt(videoStats.commentCount || '0'),
          collected_at: today
        }

        // Compute derived metrics if available
        updated.retention03 = computeRetention03(videoStats)
        updated.completion_pct = computeCompletionPct(videoStats)
        updated.ctr_thumb = computeCTRThumb(videoStats)

        updatedRecords.push(updated)
      }
    }

  } catch (error) {
    console.error('YouTube stats pull error:', error)
  }

  return updatedRecords
}

// TikTok Analytics API
async function pullTikTokStats(oauth: any, records: any[]): Promise<any[]> {
  const { access_token, open_id } = oauth
  const today = new Date().toISOString().split('T')[0]
  const updatedRecords = []

  // Note: TikTok Business API has limited analytics endpoints
  // This is a placeholder - requires specific TikTok API configuration
  console.log(`TikTok stats pull placeholder for ${records.length} videos`)

  // Placeholder implementation - would need TikTok API endpoints
  for (const record of records) {
    updatedRecords.push({
      ...record,
      collected_at: today,
      // Add computed metrics based on available TikTok data
      retention03: null, // TikTok may not provide this
      completion_pct: null,
      ctr_thumb: null
    })
  }

  return updatedRecords
}

// Instagram Analytics API
async function pullInstagramStats(oauth: any, records: any[]): Promise<any[]> {
  const { access_token, account_id } = oauth
  const today = new Date().toISOString().split('T')[0]
  const updatedRecords = []

  // Note: Instagram Graph API provides insights for business accounts
  // This is a placeholder - requires Facebook Graph API configuration
  console.log(`Instagram stats pull placeholder for ${records.length} posts`)

  // Placeholder implementation - would need Graph API endpoints
  for (const record of records) {
    updatedRecords.push({
      ...record,
      collected_at: today,
      // Add computed metrics based on available Instagram data
      retention03: null, // Instagram may not provide this directly
      completion_pct: null,
      ctr_thumb: null
    })
  }

  return updatedRecords
}

// Helper functions for YouTube authentication
async function getYouTubeAccessToken(currentToken: string, oauth: any): Promise<string> {
  // Check if token is still valid (simplified check)
  const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
    headers: { 'Authorization': `Bearer ${currentToken}` }
  })

  if (response.ok) {
    return currentToken
  }

  // Token expired, refresh it
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('YOUTUBE_CLIENT_ID')!,
      client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET')!,
      refresh_token: oauth.refresh_token,
      grant_type: 'refresh_token'
    })
  })

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh YouTube access token')
  }

  const tokenData = await refreshResponse.json()
  return tokenData.access_token
}

// Compute derived metrics (placeholders - actual computation depends on API responses)
function computeRetention03(stats: any): number | null {
  // YouTube Analytics API doesn't directly provide retention03
  // This would require YouTube Analytics API with proper scope
  return null
}

function computeCompletionPct(stats: any): number | null {
  // For videos under 30 seconds, this is typically 100%
  // Would need watch time data from YouTube Analytics
  return null
}

function computeCTRThumb(stats: any): number | null {
  // CTR calculation requires impressions data
  return null
}
