import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@vidforge/ai'
import { createRouteHandlerClient } from '../../../lib/supabase'

export async function GET(
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
    const { episodeId } = params

    // Rate limiting
    const { data: canCall, error: rpcError } = await supabase.rpc('can_call', {
      user_id_param: userId,
      route_param: '/api/insights/[episodeId]',
      per_minute_param: 10 // 10 insights requests per minute
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!canCall) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }

    // Get episode information and verify ownership
    const { data: episode, error: episodeError } = await supabase
      .from('episodes')
      .select(`
        *,
        series (
          *,
          brands (
            user_id
          )
        )
      `)
      .eq('id', episodeId)
      .single()

    if (episodeError) {
      console.error('Error fetching episode:', episodeError)
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Check if user owns this episode
    if (episode.series.brands.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get analytics data
    const { data: analytics, error: analyticsError } = await supabase
      .from('analytics')
      .select('*')
      .eq('episode_id', episodeId)
      .order('collected_at', { ascending: false })
      .limit(1)

    if (analyticsError) {
      console.error('Error fetching analytics:', analyticsError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    if (!analytics || analytics.length === 0) {
      return NextResponse.json({ error: 'No analytics data available for this episode' }, { status: 404 })
    }

    const latestAnalytics = analytics[0]

    // Get script content from timeline or scenes
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select(`
        *,
        prompts (
          output
        )
      `)
      .eq('episode_id', episodeId)
      .order('idx', { ascending: true })

    let scriptContent = ''

    if (scenesError) {
      console.error('Error fetching scenes:', scenesError)
      // Fallback to episode timeline
      if (episode.timeline) {
        scriptContent = JSON.stringify(episode.timeline)
      } else {
        scriptContent = episode.title || 'No script content available'
      }
    } else if (scenes && scenes.length > 0) {
      // Build script content from scenes
      scriptContent = scenes.map((scene: any, index: number) => {
        const promptOutput = scene.prompts?.output
        const sceneContent = promptOutput?.content || promptOutput?.voice_over || scene.src || 'Scene content not available'
        return `Scene ${index + 1}: ${sceneContent}`
      }).join('\n\n')
    } else {
      // Fallback to episode timeline
      scriptContent = episode.timeline ? JSON.stringify(episode.timeline) : episode.title || 'No script content available'
    }

    // Prepare metrics
    const metrics = {
      views: latestAnalytics.views || 0,
      retention03: latestAnalytics.retention03 || 0,
      completion_pct: latestAnalytics.completion_pct || 0,
      ctr_thumb: latestAnalytics.ctr_thumb || 0
    }

    // Generate insights using Gemini
    const result = await generateInsights(metrics, scriptContent, {
      supabase,
      userId,
      episodeId
    })

    if (!result.success) {
      console.error('Insights generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate insights' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      episode: {
        id: episode.id,
        title: episode.title,
        status: episode.status
      },
      analytics: latestAnalytics,
      insights: result.data
    })

  } catch (error: any) {
    console.error('Insights error:', error)

    if (error instanceof Error && error.message.includes('Invalid input')) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
