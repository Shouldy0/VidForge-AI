import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../lib/supabase'
import { createRenderEpisodeJob } from '../../../../worker/src/producers'
import { RenderEpisodePayloadSchema } from '@vidforge/shared/schemas'

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse and validate request body
    const body = await request.json()
    const validatedBody = RenderEpisodePayloadSchema.parse(body)

    // Verify the episode belongs to the user
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('id, title, status, duration_sec')
      .eq('id', validatedBody.render_id)
      .eq('user_id', userId) // Assuming episodes have user_id, would need to join through series

    if (episodeError || !episodeData) {
      return NextResponse.json({ error: 'Episode not found or access denied' }, { status: 404 })
    }

    // Create render record in database
    const renderId = crypto.randomUUID()
    const { data: renderData, error: renderError } = await supabase
      .from('renders')
      .insert({
        id: renderId,
        episode_id: validatedBody.render_id,
        status: 'pending',
        preset: 'default', // Could be configurable
        bitrate: 5000, // 5Mbps default
        size_mb: null // Will be calculated after render
      })
      .select()
      .single()

    if (renderError) {
      console.error('Failed to create render record:', renderError)
      return NextResponse.json({ error: 'Failed to create render job' }, { status: 500 })
    }

    // Create pg-boss job
    const jobId = await createRenderEpisodeJob({
      render_id: renderId,
    })

    console.log(`Created render job ${jobId} for render ${renderId}`)

    return NextResponse.json({
      success: true,
      jobId,
      renderId,
      render: renderData,
      message: 'Render job has been queued successfully'
    })

  } catch (error: any) {
    console.error('Render episode error:', error)

    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check render status
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const renderId = searchParams.get('renderId')

    if (!renderId) {
      return NextResponse.json({ error: 'Render ID required' }, { status: 400 })
    }

    // Get render record
    const { data: renderData, error: renderError } = await supabase
      .from('renders')
      .select(`
        id,
        episode_id,
        status,
        url,
        preset,
        bitrate,
        size_mb,
        created_at,
        updated_at
      `)
      .eq('id', renderId)
      .single()

    if (renderError || !renderData) {
      return NextResponse.json({ error: 'Render not found' }, { status: 404 })
    }

    // Verify episode ownership
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('user_id') // Would need to join through series table
      .eq('id', renderData.episode_id)
      .limit(1)

    if (episodeError) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      render: renderData
    })

  } catch (error: any) {
    console.error('Get render status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
