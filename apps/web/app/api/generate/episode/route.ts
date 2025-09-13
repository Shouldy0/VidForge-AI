import { NextRequest, NextResponse } from 'next/server'
import { generateEpisodeScript } from '@vidforge/ai'
import { createRouteHandlerClient } from 'libs/supabase'
import { GenerateEpisodeRequestSchema } from '@vidforge/shared/schemas'

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limiting
    const { data: canCall, error: rpcError } = await supabase.rpc('can_call', {
      user_id_param: userId,
      route_param: '/api/generate/episode',
      per_minute_param: 10 // 10 episode generations per minute
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!canCall) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedBody = GenerateEpisodeRequestSchema.parse(body)

    // Generate episode script using AI
    const result = await generateEpisodeScript({
      episodeId: crypto.randomUUID(), // Generate new episode ID
      seriesId: validatedBody.series_id,
      title: validatedBody.title,
      topic: validatedBody.topic,
      duration: validatedBody.duration
    }, {
      supabase,
      userId
    })

    if (!result.success) {
      console.error('Episode generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate episode script' },
        { status: 500 }
      )
    }

    // Upsert episode in database
    const episodeId = crypto.randomUUID()
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .insert({
        series_id: validatedBody.series_id,
        title: validatedBody.title,
        status: 'pending',
        timeline: result.data, // Store the script data
        duration_sec: validatedBody.duration || 60
      })
      .select()
      .single()

    if (episodeError) {
      console.error('Failed to insert episode:', episodeError)
      return NextResponse.json({ error: 'Failed to save episode' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      episode: episodeData,
      script: result.data
    })

  } catch (error: any) {
    console.error('Generate episode error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
