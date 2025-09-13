import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '../../../../lib/supabase'
import { GeminiClient, TTSClient } from '@vidforge/ai'
import { config } from '@vidforge/shared'
import { z } from 'zod'

// Request schema
const LocalizeEpisodeRequestSchema = z.object({
  episodeId: z.string().uuid(),
  targetLangs: z.array(z.string()).min(1)
})

// Response schema
const LocalizeEpisodeResponseSchema = z.object({
  success: z.boolean(),
  code: z.string(),
  parentEpisodeId: z.string(),
  variants: z.array(z.object({
    episodeId: z.string(),
    language: z.string(),
    audioUrl: z.string(),
    status: z.string()
  }))
})

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const supabase = createRouteHandlerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedBody = LocalizeEpisodeRequestSchema.parse(body)

    // Fetch original episode
    const { data: originalEpisode, error: episodeError } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', validatedBody.episodeId)
      .single()

    if (episodeError || !originalEpisode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    // Check ownership via series
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select(`brands (user_id)`)
      .eq('id', originalEpisode.series_id)
      .single()

    if (seriesError || series.brands.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Rate limiting
    const { data: canCall, error: rpcError } = await supabase.rpc('can_call', {
      user_id_param: session.user.id,
      route_param: '/api/localize/episode',
      per_minute_param: 5
    })

    if (rpcError || !canCall) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Initialize AI clients
    const geminiClient = new GeminiClient(config.GEMINI_API_KEY, {
      model: 'gemini-pro',
      temperature: 0.3,
      maxTokens: 4000,
      topP: 0.9,
      topK: 40
    })

    const ttsClient = new TTSClient()

    const variants = []

    // Process each target language
    for (const lang of validatedBody.targetLangs) {
      try {
        // 1. Translate script/captions via Gemini
        const translationPrompt = `Translate this video script to ${lang} language. Keep the same format and structure. Original script:\n\n${JSON.stringify(originalEpisode.timeline, null, 2)}`

        const translatedScript = await geminiClient.generateText(translationPrompt)

        // Parse and clean the translated JSON
        let translatedTimeline
        try {
          translatedTimeline = JSON.parse(translatedScript)
        } catch {
          // If not valid JSON, wrap in a script object
          translatedTimeline = {
            script: translatedScript,
            language: lang
          }
        }

        // Extract text for TTS synthesis
        const scriptText = typeof translatedTimeline === 'object' ? JSON.stringify(translatedTimeline) : translatedTimeline

        // 2. Synthesize TTS per lingua
        const audioBuffer = await ttsClient.synthesizeSpeech(scriptText, {
          languageCode: lang,
          voiceName: getVoiceName(lang),
          gender: 'NEUTRAL'
        })

        // 3. Upload localized audio to storage
        const audioFileName = `${validatedBody.episodeId}_localize_${lang}.mp3`
        const audioPath = `${session.user.id}/${audioFileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('localized_audio')
          .upload(audioPath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
          })

        if (uploadError) {
          throw new Error(`Audio upload failed: ${uploadError.message}`)
        }

        // Get public URL for audio
        const { data: publicUrl } = supabase.storage
          .from('localized_audio')
          .getPublicUrl(audioPath)

        // 4. Duplicate timeline with localized content
        const localizedEpisodeId = crypto.randomUUID()

        const { data: childEpisode, error: childError } = await supabase
          .from('episodes')
          .insert({
            series_id: originalEpisode.series_id,
            title: `${originalEpisode.title} (${lang})`,
            status: 'localizing',
            timeline: translatedTimeline,
            duration_sec: originalEpisode.duration_sec,
            parent_episode_id: validatedBody.episodeId,
            language: lang,
            localized_audio_url: publicUrl.publicUrl
          })
          .select()
          .single()

        if (childError) {
          throw new Error(`Child episode creation failed: ${childError.message}`)
        }

        // 5. Enqueue render job for this lingua
        const { error: enqueueError } = await supabase.rpc('enqueue_render_episode', {
          p_render_id: crypto.randomUUID(),
          p_episode_id: localizedEpisodeId,
          p_user_id: session.user.id
        })

        if (enqueueError) {
          console.error('Failed to enqueue render job:', enqueueError)
          // Don't throw here, allow partial completion
        }

        variants.push({
          episodeId: localizedEpisodeId,
          language: lang,
          audioUrl: publicUrl.publicUrl,
          status: enqueueError ? 'created' : 'render_queued'
        })

      } catch (error) {
        console.error(`Error localizing to ${lang}:`, error)
        // Continue with other languages
        variants.push({
          episodeId: null,
          language: lang,
          audioUrl: null,
          status: 'error',
          error: (error as Error).message
        })
      }
    }

    // Generate operation code
    const code = `LOC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json({
      success: true,
      code,
      parentEpisodeId: validatedBody.episodeId,
      variants
    })

  } catch (error: any) {
    console.error('Localize episode error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.issues }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Voice mapping utility function
function getVoiceName(lang: string): string {
  const voiceMap: Record<string, string> = {
    'en-US': 'en-US-Wavenet-D',
    'es-ES': 'es-ES-Wavenet-C',
    'fr-FR': 'fr-FR-Wavenet-D',
    'de-DE': 'de-DE-Wavenet-D',
    'it-IT': 'it-IT-Wavenet-D',
    'pt-BR': 'pt-BR-Wavenet-C',
    'ja-JP': 'ja-JP-Wavenet-D',
    'ko-KR': 'ko-KR-Wavenet-D',
    'zh-CN': 'cmn-CN-Wavenet-D'
  }

  return voiceMap[lang] || (lang.startsWith('en') ? 'en-US-Wavenet-D' : `${lang}-Wavenet-D`)
}
