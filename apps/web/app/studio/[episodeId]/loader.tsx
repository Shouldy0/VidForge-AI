import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '../../../lib/supabase'
import { StudioEpisode, SceneClip, SceneAsset, EpisodeTimeline } from '@vidforge/shared'

// Server component for loading episode data securely with RLS
export async function loadEpisode(episodeId: string): Promise<StudioEpisode> {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Get user session to ensure RLS security
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (!session || sessionError) {
    throw new Error('Unauthorized')
  }

  // Load episode with basic info
  const { data: episodeData, error: episodeError } = await supabase
    .from('episodes')
    .select(`
      id,
      title,
      status,
      duration_sec,
      timeline,
      created_at,
      updated_at,
      series:series_id (
        id,
        title,
        brand:brand_id (
          id,
          name,
          palette,
          voice_preset,
          font,
          cta
        )
      )
    `)
    .eq('id', episodeId)
    .single()

  if (episodeError) {
    throw new Error(`Failed to load episode: ${episodeError.message}`)
  }

  // Load scenes for this episode
  const { data: scenesData, error: scenesError } = await supabase
    .from('scenes')
    .select(`
      id,
      idx,
      t_start,
      t_end,
      type,
      src,
      pan_zoom,
      prompt_id
    `)
    .eq('episode_id', episodeId)
    .order('idx', { ascending: true })

  if (scenesError) {
    console.error('Error loading scenes:', scenesError)
  }

  // Load assets for this user's media
  const { data: assetsData, error: assetsError } = await supabase
    .from('assets')
    .select(`
      id,
      kind,
      url,
      width,
      height,
      duration_sec,
      meta
    `)
    .eq('owner_id', session.user.id)
    .in('kind', ['video', 'image', 'audio'])
    .order('created_at', { ascending: false })

  if (assetsError) {
    console.error('Error loading assets:', assetsError)
  }

  // Get signed URLs for all assets (for previews)
  const signedUrls: Record<string, string> = {}
  if (assetsData) {
    for (const asset of assetsData) {
      if (asset.url) {
        try {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('videos') // or appropriate bucket
            .createSignedUrl(asset.url, 3600) // 1 hour expiry

          if (signedUrlData && !signedUrlError) {
            signedUrls[asset.id] = signedUrlData.signedUrl
          }
        } catch (error) {
          console.error(`Failed to get signed URL for asset ${asset.id}:`, error)
        }
      }
    }
  }

  // Transform scenes data to match our interface
  const scenes: SceneClip[] = scenesData?.map(scene => ({
    id: scene.id,
    start: scene.t_start || 0,
    end: scene.t_end || 0,
    duration: (scene.t_end || 0) - (scene.t_start || 0),
    type: scene.type || 'visual',
    src: scene.src,
    signedUrl: signedUrls[scene.src] || scene.src,
    assets: [], // Will be populated from timeline
    prompt: '', // We can load this separately if needed
    editableText: scene.type === 'text' ? scene.src : undefined
  })) || []

  // Transform assets data
  const assets: SceneAsset[] = assetsData?.map(asset => ({
    id: asset.id,
    type: asset.kind as 'image' | 'video' | 'audio',
    src: asset.url,
    signedUrl: signedUrls[asset.id],
    duration: asset.duration_sec || 0,
    start: 0,
    end: asset.duration_sec || 0,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    scale: [1, 1, 1],
    opacity: 1,
    panZoom: undefined
  })) || []

  // Parse timeline JSON
  const timeline: EpisodeTimeline = episodeData.timeline ? {
    ...episodeData.timeline,
    // Ensure required fields exist
    version: episodeData.timeline.version || '1.0',
    title: episodeData.timeline.title || episodeData.title,
    duration: episodeData.timeline.duration || episodeData.duration_sec || 0,
    fps: episodeData.timeline.fps || 30,
    resolution: episodeData.timeline.resolution || [1920, 1080],
    scenes: episodeData.timeline.scenes || scenes,
    captions: episodeData.timeline.captions || [],
    audio: episodeData.timeline.audio || {}
  } : {
    version: '1.0',
    title: episodeData.title,
    duration: episodeData.duration_sec || 0,
    fps: 30,
    resolution: [1920, 1080],
    scenes: scenes,
    captions: [],
    audio: {}
  }

  const episode: StudioEpisode = {
    id: episodeData.id,
    title: episodeData.title,
    status: episodeData.status,
    duration: episodeData.duration_sec || 0,
    timeline,
    series: episodeData.series ? {
      id: episodeData.series.id,
      title: episodeData.series.title,
      brand: episodeData.series.brand
    } : undefined,
    scenes: timeline.scenes,
    assets,
    renders: [] // Will be loaded via API if needed
  }

  return episode
}
