import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../../lib/supabase'
import { StudioScore } from '@vidforge/shared'

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
    const episodeId = params.episodeId

    // Load episode data for scoring
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('id, title, status, duration_sec, timeline')
      .eq('id', episodeId)
      .single()

    if (episodeError || !episodeData) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Basic scoring algorithm
    const timeline = episodeData.timeline
    let overall = 100 // Start with perfect score
    const breakdown = {
      pacing: 100,
      visualQuality: 100,
      audioQuality: 100,
      engagement: 100
    }
    const recommendations: string[] = []

    // Check scene count and timing
    if (timeline?.scenes) {
      const sceneCount = timeline.scenes.length
      const totalDuration = timeline.scenes.reduce((sum: number, scene: any) => sum + scene.duration, 0)

      // Pacing score based on scene distribution
      if (sceneCount < 2) {
        breakdown.pacing = 60
        recommendations.push('Consider breaking down the episode into more scenes for better pacing')
      } else if (sceneCount > 10) {
        breakdown.pacing = 70
        recommendations.push('Consider consolidating scenes to improve flow')
      } else {
        breakdown.pacing = 90
      }

      // Visual quality based on assets and variety
      const uniqueAssetTypes = new Set(timeline.scenes.flatMap((scene: any) => scene.assets?.map((a: any) => a.type) || []))
      if (uniqueAssetTypes.size < 2) {
        breakdown.visualQuality = 60
        recommendations.push('Consider using a variety of visual assets for more engaging content')
      } else {
        breakdown.visualQuality = 85
      }
    } else {
      breakdown.pacing = 20
      breakdown.visualQuality = 20
      recommendations.push('No timeline data found - generate episode scenes first')
    }

    // Caption quality
    if (timeline?.captions && timeline.captions.length > 0) {
      breakdown.engagement = 85
      if (timeline.captions.length < Math.floor((timeline.duration / episodeData.duration_sec) / 5)) {
        recommendations.push('Consider adding more captions for better accessibility and engagement')
      }
    } else {
      breakdown.engagement = 40
      recommendations.push('Captions will significantly improve accessibility and engagement')
    }

    // Audio quality (if we have audio data)
    if (timeline?.audio) {
      breakdown.audioQuality = 80
    } else {
      breakdown.audioQuality = 50
      recommendations.push('Consider adding background music or voiceover for better audio quality')
    }

    // Calculate overall score
    overall = Math.round((breakdown.pacing + breakdown.visualQuality + breakdown.audioQuality + breakdown.engagement) / 4)

    // Add general recommendations
    if (overall >= 80) {
      recommendations.unshift('Excellent work! Your episode is ready for rendering.')
    } else if (overall >= 60) {
      recommendations.unshift('Good foundation. Addressing the recommendations below will improve your score.')
    } else {
      recommendations.unshift('Consider regenerating content or adding more scenes to improve quality.')
    }

    const score: StudioScore = {
      overall,
      breakdown,
      recommendations
    }

    return NextResponse.json({
      success: true,
      score
    })

  } catch (error: any) {
    console.error('Score episode error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
