import { NextRequest, NextResponse } from 'next/server'
import { generateSeriesPlan } from '@vidforge/ai'
import { createRouteHandlerClient } from '../../../lib/supabase'
import { GenerateSeriesRequestSchema } from '@vidforge/shared/schemas'

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
      route_param: '/api/generate/series',
      per_minute_param: 5 // 5 series generations per minute
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
    const validatedBody = GenerateSeriesRequestSchema.parse(body)

    // Generate series plan using AI
    const result = await generateSeriesPlan(validatedBody, {
      supabase,
      userId
    })

    if (!result.success) {
      console.error('Series generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate series plan' },
        { status: 500 }
      )
    }

    // Upsert series in database
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .insert({
        brand_id: validatedBody.brand_id,
        title: validatedBody.title,
        topic: validatedBody.topic,
        cadence: validatedBody.cadence || 'weekly',
        language: validatedBody.language || 'English',
        status: 'active'
      })
      .select()
      .single()

    if (seriesError) {
      console.error('Failed to insert series:', seriesError)
      return NextResponse.json({ error: 'Failed to save series' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      series: seriesData,
      plan: result.data
    })

  } catch (error: any) {
    console.error('Generate series error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
