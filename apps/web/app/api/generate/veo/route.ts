import { NextRequest, NextResponse } from 'next/server'
import { generateVeoHook } from '@vidforge/ai'
import { createRouteHandlerClient } from '../../../lib/supabase'
import { GenerateVeoRequestSchema } from '@vidforge/shared/schemas'

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
      route_param: '/api/generate/veo',
      per_minute_param: 2 // 2 Veo generations per minute (expensive operation)
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
    const validatedBody = GenerateVeoRequestSchema.parse(body)

    // Generate Veo video using AI
    const result = await generateVeoHook({
      episodeId: validatedBody.episode_id,
      seriesId: validatedBody.series_id,
      prompt: validatedBody.prompt,
      duration: validatedBody.duration,
      resolution: validatedBody.resolution,
      aspectRatio: validatedBody.aspectRatio,
      fps: validatedBody.fps
    }, {
      supabase,
      userId
    })

    if (!result.success) {
      console.error('Veo generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate Veo video' },
        { status: 500 }
      )
    }

    // Get the newly created asset
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('owner_id', userId)
      .eq('kind', 'video_hook')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (assetError) {
      console.error('Failed to retrieve generated video asset:', assetError)
      return NextResponse.json({ error: 'Failed to retrieve generated video' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      videoBytes: result.mp4Bytes,
      asset: assetData
    })

  } catch (error: any) {
    console.error('Generate Veo error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
