import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../lib/supabase'
import { GenerateVeoRequestSchema } from '@vidforge/shared/schemas'
import { generateVeoHook } from '@vidforge/ai'

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
      route_param: '/api/generate/scene',
      per_minute_param: 5 // 5 scene generations per minute
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

    // Apply scene-specific parameters
    const sceneParams = {
      ...validatedBody,
      // Use shorter duration for scenes
      duration: Math.min(validatedBody.duration || 10, 15),
      // Maybe use different resolution for scenes
      resolution: validatedBody.resolution || '1080p'
    }

    // Generate scene using VEO AI
    const result = await generateVeoHook(sceneParams, {
      supabase,
      userId
    })

    if (!result.success) {
      console.error('Scene generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate scene' },
        { status: 500 }
      )
    }

    // Create scene record in database
    const sceneId = crypto.randomUUID()
    const { data: sceneData, error: sceneError } = await supabase
      .from('scenes')
      .insert({
        episode_id: validatedBody.episode_id,
        id: sceneId,
        type: 'visual',
        src: result.mp4Bytes ? 'generated_video' : '',
        prompt_id: null, // Would link to prompts table if needed
        t_start: 0, // Would be calculated based on timeline
        t_end: sceneParams.duration,
        pan_zoom: null
      })
      .select()
      .single()

    if (sceneError) {
      console.error('Failed to save scene:', sceneError)
      return NextResponse.json({ error: 'Failed to save scene' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      scene: sceneData,
      videoUrl: result.mp4Bytes
    })

  } catch (error: any) {
    console.error('Generate scene error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
