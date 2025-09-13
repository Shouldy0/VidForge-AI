import { NextRequest, NextResponse } from 'next/server'
import { generateCoverImage } from '@vidforge/ai'
import { createRouteHandlerClient } from '../../../lib/supabase'
import { GenerateCoverRequestSchema } from '@vidforge/shared/schemas'

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
      route_param: '/api/generate/cover',
      per_minute_param: 3 // 3 cover generations per minute
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
    const validatedBody = GenerateCoverRequestSchema.parse(body)

    // Generate cover image using AI
    const result = await generateCoverImage({
      episodeId: validatedBody.episode_id,
      seriesId: validatedBody.series_id,
      title: validatedBody.title,
      topic: validatedBody.topic,
      style: validatedBody.style
    }, {
      supabase,
      userId
    })

    if (!result.success) {
      console.error('Cover generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate cover image' },
        { status: 500 }
      )
    }

    // Get the newly created asset
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('owner_id', userId)
      .eq('kind', 'thumbnail')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (assetError) {
      console.error('Failed to retrieve generated asset:', assetError)
      return NextResponse.json({ error: 'Failed to retrieve generated image' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      image: result.base64Image,
      asset: assetData
    })

  } catch (error: any) {
    console.error('Generate cover error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
