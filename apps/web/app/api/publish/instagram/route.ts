import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

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
    const { episode_id, title, description } = body

    // Validate required fields
    if (!episode_id) {
      return NextResponse.json(
        { error: 'Missing required field: episode_id' },
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

    // Call the Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/publish-instagram`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        episode_id,
        title: title || episodeData.title,
        description: description || '',
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Instagram edge function error:', errorData)
      return NextResponse.json(
        { error: 'Failed to publish to Instagram', details: errorData },
        { status: response.status }
      )
    }

    const responseData = await response.json()

    return NextResponse.json({
      success: true,
      postId: responseData.postId,
      postUrl: responseData.url,
      message: 'Video published to Instagram successfully'
    })

  } catch (error) {
    console.error('Instagram publish error:', error)
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

    const { searchParams } = new URL(request.url)
    const episodeId = searchParams.get('episode_id')

    if (!episodeId) {
      return NextResponse.json({ error: 'Episode ID required' }, { status: 400 })
    }

    // Check if episode has been published to Instagram
    const { data: analytics, error } = await supabase
      .from('analytics')
      .select('video_id, platform, collected_at')
      .eq('episode_id', episodeId)
      .eq('platform', 'instagram')
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
      postId: analytics.video_id,
      postUrl: analytics.url,
      publishedAt: analytics.collected_at
    })

  } catch (error) {
    console.error('Check publish status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
