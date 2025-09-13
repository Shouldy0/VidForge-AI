import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface YouTubePublishRequest {
  episode_id: string
  title: string
  description: string
  tags: string[]
  visibility: 'private' | 'public' | 'unlisted'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body: YouTubePublishRequest = await req.json()

    // Validate required fields
    if (!body.episode_id || !body.title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: episode_id, title' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get YouTube credentials from database (you might want to store these in the database or environment)
    const youtubeClientId = Deno.env.get('YOUTUBE_CLIENT_ID')!
    const youtubeClientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!
    const youtubeRefreshToken = Deno.env.get('YOUTUBE_REFRESH_TOKEN')!

    if (!youtubeClientId || !youtubeClientSecret || !youtubeRefreshToken) {
      throw new Error('YouTube credentials not configured')
    }

    // Fetch episode and render URL
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select(`
        id,
        title,
        series (
          brand_id,
          brands (
            user_id,
            name
          )
        )
      `)
      .eq('id', body.episode_id)
      .single()

    if (episodeError || !episode) {
      throw new Error(`Episode not found: ${episodeError?.message}`)
    }

    // Get the render for this episode
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

    // Get access token from YouTube
    const accessToken = await getYouTubeAccessToken(youtubeClientId, youtubeClientSecret, youtubeRefreshToken)

    // Download video file from Supabase storage
    const videoResponse = await fetch(render.url)
    if (!videoResponse.ok) {
      throw new Error('Failed to download video file')
    }

    const videoBuffer = await videoResponse.arrayBuffer()

    // Initialize YouTube upload
    const uploadUrl = await initYouTubeUpload(accessToken, body, videoBuffer.byteLength)

    // Perform resumable upload
    const videoId = await performResumableUpload(accessToken, uploadUrl, videoBuffer)

    // Save videoId to analytics table
    const { error: analyticsError } = await supabase
      .from('analytics')
      .insert({
        episode_id: body.episode_id,
        platform: 'youtube',
        video_id: videoId,
        collected_at: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      })

    if (analyticsError) {
      console.error('Failed to save to analytics:', analyticsError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('YouTube publish error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to publish to YouTube',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Get YouTube OAuth2 access token
async function getYouTubeAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`Failed to get access token: ${errorData}`)
  }

  const data = await response.json()
  return data.access_token
}

// Initialize YouTube upload
async function initYouTubeUpload(accessToken: string, body: YouTubePublishRequest, fileSize: number): Promise<string> {
  const snippett = {
    title: body.title,
    description: body.description || '',
    tags: body.tags || [],
  }

  const status = {
    privacyStatus: body.visibility,
  }

  const requestBody = {
    snippet: snippett,
    status: status,
  }

  const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': fileSize.toString(),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`Failed to initialize YouTube upload: ${errorData}`)
  }

  return response.headers.get('Location')!
}

// Perform resumable upload
async function performResumableUpload(accessToken: string, uploadUrl: string, videoBuffer: ArrayBuffer): Promise<string> {
  const chunkSize = 256 * 1024 // 256KB chunks
  const totalSize = videoBuffer.byteLength
  let uploadedSize = 0

  while (uploadedSize < totalSize) {
    const chunkSizeActual = Math.min(chunkSize, totalSize - uploadedSize)
    const startByte = uploadedSize
    const endByte = uploadedSize + chunkSizeActual - 1

    const chunk = videoBuffer.slice(startByte, endByte + 1)

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunkSizeActual.toString(),
        'Content-Range': `bytes ${startByte}-${endByte}/${totalSize}`,
        'Content-Type': 'video/mp4',
      },
      body: chunk,
    })

    if (!response.ok) {
      if (response.status === 308) {
        // Resume incomplete - YouTube tells us which bytes it has
        const rangeHeader = response.headers.get('Range')
        if (rangeHeader) {
          const lastByte = parseInt(rangeHeader.split('-')[1]) + 1
          if (lastByte > uploadedSize) {
            uploadedSize = lastByte
          }
        }
        continue
      } else {
        const errorData = await response.text()
        throw new Error(`Upload chunk failed: ${errorData}`)
      }
    } else {
      // Upload complete
      const data = await response.json()
      return data.id
    }
  }

  throw new Error('Upload completed but no video ID received')
}
