import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../../lib/supabase'
import { EpisodeTimeline } from '@vidforge/shared'

export async function PUT(
  request: NextRequest,
  { params }: { params: { episodeId: string } }
) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const episodeId = params.episodeId

    // Parse request body
    const { timeline }: { timeline: EpisodeTimeline } = await request.json()

    if (!timeline) {
      return NextResponse.json({ error: 'Timeline data required' }, { status: 400 })
    }

    // Update the episode's timeline
    const { data: existingEpisode, error: fetchError } = await supabase
      .from('episodes')
      .select('id, series_id')
      .eq('id', episodeId)
      .single()

    if (fetchError) {
      console.error('Failed to fetch episode:', fetchError)
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Update timeline - assuming episodes table has a timeline jsonb column
    const { data: updatedEpisode, error: updateError } = await supabase
      .from('episodes')
      .update({
        timeline,
        updated_at: new Date()
      })
      .eq('id', episodeId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update timeline:', updateError)
      return NextResponse.json({ error: 'Failed to save timeline' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      episode: updatedEpisode,
      message: 'Timeline saved successfully'
    })

  } catch (error: any) {
    console.error('Save timeline error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
