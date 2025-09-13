import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const { episode_id, title, description, tags, visibility } = body

    // Validate required fields
    if (!episode_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: episode_id, title' },
        { status: 400 }
      )
    }

    // Verify the episode belongs to the user
    const { data: episodeData, error: episodeError } = await supabase
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
      .eq('id', episode_id)
      .eq('series.brands.user_id', userId)
      .single()

    if (episodeError || !episodeData) {
      return NextResponse.json({ error: 'Episode not found or access denied' }, { status: 404 })
    }

    // Check if episode has music when publishing
    const { data: musicCheck, error: musicError } = await supabase
      .from('music_tracks')
      .select('id, title, allowlist')
      .eq('id', episodeData.music_id || '')
      .maybeSingle()

    if (musicCheck && !musicCheck.allowlist) {
      return NextResponse.json(
        {
          error: 'Cannot publish: Music track must be allowlisted',
          details: { trackTitle: musicCheck.title, trackId: musicCheck.id }
        },
        { status: 400 }
      )
    }

    // Call the Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/publish-youtube`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        episode_id,
        title,
        description: description || '',
        tags: tags || [],
        visibility: visibility || 'private'
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Edge function error:', errorData)
      return NextResponse.json(
        { error: 'Failed to publish to YouTube', details: errorData },
        { status: response.status }
      )
    }

    const responseData = await response.json()

    return NextResponse.json({
      success: true,
      videoId: responseData.videoId,
      videoUrl: responseData.videoUrl,
      message: 'Video published to YouTube successfully'
    })

  } catch (error) {
    console.error('YouTube publish error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET method to check publish status
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const episodeId = searchParams.get('episode_id')

    if (!episodeId) {
      return NextResponse.json({ error: 'Episode ID required' }, { status: 400 })
    }

    // Check if episode has been published to YouTube
    const { data: analytics, error } = await supabase
      .from('analytics')
      .select('video_id, platform, collected_at')
      .eq('episode_id', episodeId)
      .eq('platform', 'youtube')
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!analytics) {
      return NextResponse.json({ published: false })
    }

    return NextResponse.json({
      published: true,
      videoId: analytics.video_id,
      videoUrl: `https://www.youtube.com/watch?v=${analytics.video_id}`,
      publishedAt: analytics.collected_at
    })

  } catch (error) {
    console.error('Check publish status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
