import { GeminiClient } from './gemini'
import { VeoClient } from './veo'
import { TTSClient } from './tts'
import { config } from '../../shared/src/env'
import { createHash } from 'crypto'
import {
  AIFunctionParams,
  GenerateSeriesPlanInput,
  GenerateSeriesPlanResponse,
  GenerateEpisodeScriptInput,
  GenerateEpisodeScriptResponse,
  GenerateCoverImageInput,
  GenerateCoverImageResponse,
  GenerateVeoHookInput,
  GenerateVeoHookResponse,
  ScorePublishReadinessInput,
  ScorePublishReadinessResponse,
  TTSSynthesizeInput,
  TTSSynthesizeResponse,
} from './types'

// Initialize AI clients
const geminiClient = new GeminiClient(config.GEMINI_API_KEY, {
  model: 'gemini-pro',
  temperature: 0.7,
})

const veoClient = new VeoClient('vidforge-ai', 'us-central1') // Project and location - adjust as needed

const ttsClient = new TTSClient()

/**
 * Generate a series plan using Gemini AI
 */
export async function generateSeriesPlan(
  input: GenerateSeriesPlanInput,
  { supabase, userId }: AIFunctionParams
): Promise<GenerateSeriesPlanResponse> {
  try {
    const prompt = `Create a comprehensive series plan for a video series with the following details:
Title: ${input.title}
Topic: ${input.topic}
Cadence: ${input.cadence || 'weekly'}
Language: ${input.language || 'English'}

Please generate a JSON response with:
- series_overview: brief description
- episode_structure: how many episodes, typical length
- content_pillars: main themes
- target_audience: who this is for
- hook_strategy: how to engage viewers
- series_goals: what you want to achieve

Format as valid JSON.`

    const planJson = await geminiClient.generateText(prompt)
    let planData

    try {
      planData = JSON.parse(planJson)
    } catch (parseError) {
      console.error('Failed to parse generated plan JSON:', parseError)
      planData = { raw_response: planJson }
    }

    // Save to prompts table
    const { error } = await supabase
      .from('prompts')
      .insert({
        user_id: userId,
        type: 'series',
        input: input,
        output: planData,
      })

    if (error) {
      console.error('Failed to save series plan to prompts:', error)
    }

    return {
      success: true,
      data: planData,
    }
  } catch (error) {
    console.error('Error in generateSeriesPlan:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate episode script using Gemini AI
 */
export async function generateEpisodeScript(
  input: GenerateEpisodeScriptInput,
  { supabase, userId }: AIFunctionParams
): Promise<GenerateEpisodeScriptResponse> {
  try {
    const duration = input.duration || 60 // default 60 seconds

    const prompt = `Create a detailed video script for an episode with these details:
Episode Title: ${input.title}
Topic: ${input.topic || 'General content'}
Target Duration: ${duration} seconds
Episode ID: ${input.episodeId}
Series ID: ${input.seriesId}

Please generate a JSON response with:
- script_sections: array of sections with timing, content, visual descriptions
- key_points: main takeaways
- call_to_action: suggested CTAs
- estimated_duration: calculated total duration
- speaking_notes: key phrases to emphasize

Structure the script as a JSON array of scenes with this format:
[
  {
    "start_time": "0:00",
    "duration": 15,
    "content": "Introduction text",
    "visual": "Visual description",
    "voice_over": "Script text"
  }
]

Format as valid JSON.`

    const scriptJson = await geminiClient.generateText(prompt)
    let scriptData

    try {
      scriptData = JSON.parse(scriptJson)
    } catch (parseError) {
      console.error('Failed to parse generated script JSON:', parseError)
      scriptData = { raw_response: scriptJson }
    }

    // Save to prompts table
    const { error } = await supabase
      .from('prompts')
      .insert({
        user_id: userId,
        type: 'script',
        input: input,
        output: scriptData,
      })

    if (error) {
      console.error('Failed to save script to prompts:', error)
    }

    return {
      success: true,
      data: scriptData,
    }
  } catch (error) {
    console.error('Error in generateEpisodeScript:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate cover image using AI
 */
export async function generateCoverImage(
  input: GenerateCoverImageInput,
  { supabase, userId }: AIFunctionParams
): Promise<GenerateCoverImageResponse> {
  try {
    // For now, use Gemini to generate image description and simulate base64
    // In a real implementation, you'd use an image generation API like DALL-E, Midjourney, etc.
    const prompt = `Generate a text description for a compelling thumbnail/cover image for a video with:
Title: ${input.title}
Topic: ${input.topic || ''}
Episode ID: ${input.episodeId}
${input.seriesId ? `Series ID: ${input.seriesId}` : ''}
Style: ${input.style || 'modern, professional, engaging'}

Provide a detailed visual description suitable for AI image generation, including:
- Main subject and composition
- Color scheme
- Text elements to overlay
- Style and mood

Format as JSON with keys: description, colors, text_overlay, style_tips`

    const imagePrompt = await geminiClient.generateText(prompt)

    // Simulate base64 image generation
    // In production, replace this with actual image generation API call
    const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jzyr5gAAAABJRU5ErkJggg=='

    // Upload to storage
    const filePath = `thumbs/${userId}/${input.episodeId}.png`
    const { error: uploadError } = await supabase.storage
      .from('thumbs')
      .upload(filePath, mockBase64, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error('Failed to upload image to storage:', uploadError)
      return {
        success: false,
        error: 'Failed to upload image to storage',
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('thumbs')
      .getPublicUrl(filePath)

    // Save assets row
    const { error: insertError } = await supabase
      .from('assets')
      .insert({
        owner_id: userId,
        kind: 'thumbnail',
        url: publicUrl,
        meta: {
          episode_id: input.episodeId,
          prompt: imagePrompt,
        },
      })

    if (insertError) {
      console.error('Failed to save asset row:', insertError)
      return {
        success: false,
        error: 'Failed to save asset metadata',
      }
    }

    return {
      success: true,
      base64Image: mockBase64,
    }
  } catch (error) {
    console.error('Error in generateCoverImage:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate Veo hook video
 */
export async function generateVeoHook(
  input: GenerateVeoHookInput,
  { supabase, userId }: AIFunctionParams
): Promise<GenerateVeoHookResponse> {
  try {
    const videoResponse = await veoClient.generateVideo(input.prompt, {
      model: 'veo-2',
      duration: input.duration,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      fps: input.fps || 30,
    })

    if (!videoResponse.success || !videoResponse.data) {
      return {
        success: false,
        error: videoResponse.error || 'Video generation failed',
      }
    }

    // Simulate downloading MP4 bytes
    // In production, you'd fetch the actual video bytes
    const mockMp4Bytes = new Uint8Array([0x00, 0x01, 0x02]) // Mock MP4 bytes

    // Upload to storage
    const filePath = `assets/${userId}/${input.episodeId}/hook.mp4`
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, mockMp4Bytes, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadError) {
      console.error('Failed to upload video to storage:', uploadError)
      return {
        success: false,
        error: 'Failed to upload video to storage',
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath)

    // Save assets row
    const { error: insertError } = await supabase
      .from('assets')
      .insert({
        owner_id: userId,
        kind: 'video_hook',
        url: publicUrl,
        duration_sec: input.duration,
        meta: {
          episode_id: input.episodeId,
          veo_video_id: videoResponse.data.id,
          prompt: input.prompt,
          resolution: input.resolution,
          aspect_ratio: input.aspectRatio,
        },
      })

    if (insertError) {
      console.error('Failed to save video asset row:', insertError)
      return {
        success: false,
        error: 'Failed to save video asset metadata',
      }
    }

    return {
      success: true,
      mp4Bytes: mockMp4Bytes,
    }
  } catch (error) {
    console.error('Error in generateVeoHook:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate insights from episode analytics and script
 */
export async function generateInsights(
  metrics: {
    views: number;
    retention03: number;
    completion_pct: number;
    ctr_thumb: number;
  },
  script: string,
  { supabase, userId, episodeId }: AIFunctionParams & { episodeId: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const prompt = `Analyze the following video performance metrics and script content to generate actionable insights for improvement:

PERFORMANCE METRICS:
- Views: ${metrics.views}
- 3-second retention: ${(metrics.retention03 * 100).toFixed(1)}%
- Completion percentage: ${(metrics.completion_pct * 100).toFixed(1)}%
- Thumbnail CTR: ${(metrics.ctr_thumb * 100).toFixed(1)}%

SCRIPT CONTENT:
${script}

Please provide actionable recommendations in JSON format with:
- performance_summary: brief overview of current performance
- identified_issues: array of specific problems based on metrics
- actionable_fixes: array of concrete, implementable suggestions
- next_hook_variants: array of alternative hook/Opening strategies to test
- priority_score: number 1-10 for how urgent action is needed

Focus on:
1. Improving retention and completion rates
2. Optimizing hooks and engagement
3. Content structure improvements
4. Visual/audio recommendations where relevant

Format as valid JSON.`

    const insightsJson = await geminiClient.generateText(prompt)
    let insightsData

    try {
      insightsData = JSON.parse(insightsJson)
    } catch (parseError) {
      console.error('Failed to parse insights JSON:', parseError)
      insightsData = {
        performance_summary: 'Error parsing AI response',
        identified_issues: [],
        actionable_fixes: [],
        next_hook_variants: [],
        priority_score: 5,
        raw_response: insightsJson,
      }
    }

    // Save to prompts table
    const { error } = await supabase
      .from('prompts')
      .insert({
        user_id: userId,
        type: 'insights',
        input: { metrics, script, episodeId },
        output: insightsData,
      })

    if (error) {
      console.error('Failed to save insights to prompts:', error)
    }

    return {
      success: true,
      data: insightsData,
    }
  } catch (error) {
    console.error('Error in generateInsights:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Score publish readiness
 */
export async function scorePublishReadiness(
  input: ScorePublishReadinessInput,
  { supabase, userId }: AIFunctionParams
): Promise<ScorePublishReadinessResponse> {
  try {
    const prompt = `Score the publish readiness of a video episode on a scale of 1-10 and provide feedback:

Episode Title: ${input.title}
Episode ID: ${input.episodeId}
${input.content ? `Content: ${input.content}` : ''}

Please evaluate based on these criteria:
- Content Quality: Is the content original, valuable, and engaging?
- Length and Pacing: Is the timing appropriate?
- Hook and Introduction: Does it grab attention immediately?
- Call to Action: Is there a clear CTA?
- Overall Polish: Production quality, audio, visuals

Provide a JSON response with:
- score: number from 1-10
- feedback: detailed feedback with specific recommendations
- criteria_scores: breakdown by category
- ready_to_publish: boolean recommendation

Format as valid JSON.`

    const scoreJson = await geminiClient.generateText(prompt)
    let scoreData

    try {
      scoreData = JSON.parse(scoreJson)
    } catch (parseError) {
      console.error('Failed to parse score JSON:', parseError)
      scoreData = {
        score: 5,
        feedback: 'Error parsing AI response',
        raw_response: scoreJson,
      }
    }

    // Save to prompts table
    const { error } = await supabase
      .from('prompts')
      .insert({
        user_id: userId,
        type: 'score',
        input: input,
        output: scoreData,
      })

    if (error) {
      console.error('Failed to save score to prompts:', error)
    }

    return {
      success: true,
      score: scoreData.score,
      feedback: scoreData.feedback,
    }
  } catch (error) {
    console.error('Error in scorePublishReadiness:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',    }
  }
}

/**
 * Synthesize text to speech using Google Cloud TTS
 */
export async function ttsSynthesize(
  input: TTSSynthesizeInput,
  { supabase, userId }: AIFunctionParams
): Promise<TTSSynthesizeResponse> {
  try {
    // Create hash for caching based on text and voice parameters
    const voiceString = `${input.voiceName || ''}_${input.voiceGender || ''}_${input.languageCode || ''}_${input.speakingRate || ''}_${input.pitch || ''}`
    const hashInput = input.text + voiceString
    const hash = createHash('sha256').update(hashInput).digest('hex')

    const cacheKey = `tts/${hash}.mp3`
    const filePath = `assets/${userId}/tts/${hash}.mp3`

    // Check if cached version exists
    let cacheExists = false
    try {
      const { data, error } = await supabase.storage
        .from('assets')
        .list(`${userId}/tts/`, {
          search: `${hash}.mp3`,
        })

      if (data && data.length > 0) {
        cacheExists = true
      }
    } catch {
      // If list fails, assume no cache
    }

    if (cacheExists && input.cache !== false) {
      // Return cached version
      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath)

      const { data: existingAsset, error: assetError } = await supabase
        .from('assets')
        .select('*')
        .eq('url', publicUrl)
        .single()

      if (!assetError && existingAsset) {
        // Get duration from existing asset metadata
        const duration = typeof existingAsset.duration_sec === 'number' ? existingAsset.duration_sec : undefined

        if (duration !== undefined) {
          return {
            success: true,
            url: publicUrl,
            duration: duration,
            hash: hash,
          }
        }
      }
    }

    // Generate new TTS audio
    const ttsOptions = {
      languageCode: input.languageCode,
      voiceName: input.voiceName,
      gender: input.voiceGender,
      speakingRate: input.speakingRate,
      pitch: input.pitch,
    }

    const audioContent = await ttsClient.synthesizeSpeech(input.text, ttsOptions)

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, audioContent, {
        contentType: 'audio/mpeg',
        upsert: true,
      })

    if (uploadError) {
      console.error('Failed to upload TTS audio to storage:', uploadError)
      return {
        success: false,
        error: 'Failed to upload audio to storage',
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('assets')
      .getPublicUrl(filePath)

    // Get audio duration using ffprobe
    let duration: number | undefined
    try {
      const { spawn } = require('child_process')
      const ffprobePath = config.FFPROBE_PATH

      const ffprobe = spawn(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        publicUrl
      ], { stdio: 'pipe' })

      const chunks: Buffer[] = []
      ffprobe.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

      await new Promise((resolve, reject) => {
        ffprobe.on('close', resolve)
        ffprobe.on('error', reject)
      })

      const output = Buffer.concat(chunks).toString()
      const metadata = JSON.parse(output)
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio')
      if (audioStream && audioStream.duration) {
        duration = parseFloat(audioStream.duration)
      }
    } catch (ffprobeError) {
      console.warn('Failed to get audio duration with ffprobe, skipping duration:', ffprobeError)
    }

    // Save assets row
    const { error: insertError } = await supabase
      .from('assets')
      .insert({
        owner_id: userId,
        kind: 'audio',
        url: publicUrl,
        duration_sec: duration,
        meta: {
          hash: hash,
          text_sample: input.text.substring(0, 100),
          voice_name: input.voiceName,
          voice_gender: input.voiceGender,
          language_code: input.languageCode,
          speaking_rate: input.speakingRate,
          pitch: input.pitch,
          episode_id: input.episodeId,
        },
      })

    if (insertError) {
      console.error('Failed to save TTS asset row:', insertError)
      return {
        success: false,
        error: 'Failed to save audio asset metadata',
      }
    }

    // Update timeline voiceover if episodeId provided
    if (input.episodeId) {
      try {
        // Fetch current timeline
        const { data: episode, error: fetchError } = await supabase
          .from('episodes')
          .select('timeline')
          .eq('id', input.episodeId)
          .single()

        if (fetchError) {
          console.error('Failed to fetch episode timeline:', fetchError)
        } else if (episode?.timeline) {
          // Update voiceover path in timeline
          const updatedTimeline = {
            ...episode.timeline,
            audio: {
              ...episode.timeline.audio,
              voiceover: publicUrl,
            },
          }

          const { error: updateError } = await supabase
            .from('episodes')
            .update({ timeline: updatedTimeline })
            .eq('id', input.episodeId)

          if (updateError) {
            console.error('Failed to update episode timeline:', updateError)
          }
        }
      } catch (timelineError) {
        console.error('Error updating timeline voiceover:', timelineError)
        // Continue without failing the main function
      }
    }

    return {
      success: true,
      url: publicUrl,
      duration: duration || 0,
      hash: hash,
    }
  } catch (error) {
    console.error('Error in ttsSynthesize:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
