import { getPGBoss } from './index'
import type { GenerateEpisodePayload, RenderEpisodePayload, PublishVideoPayload } from '@vidforge/shared'
import { createClient } from '@supabase/supabase-js'
import PgBoss from 'pg-boss'
import ffmpeg from 'fluent-ffmpeg'
import { config } from '@vidforge/shared'
import fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'
import { exec, createWriteStream } from 'child_process'
import { promisify } from 'util'
import https from 'https'

const execAsync = promisify(exec)

// Consumer handler types for each queue
export interface JobHandler<T = any> {
  (job: PgBoss.Job<T>): Promise<void>
}

// Progress logging utility
async function logJobProgress(jobId: string, queueName: string, message: string, progress?: number, metadata?: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log(`[${queueName}] ${message}`, metadata);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'jobs' }
  });

  try {
    await supabase
      .schema('jobs')
      .from('job_log')
      .insert({
        job_id: jobId,
        queue_name: queueName,
        message,
        progress,
        metadata
      });
  } catch (error) {
    console.error('Failed to log job progress:', error);
  }
}

// Consumer handlers for each queue

export const generateEpisodeHandler: JobHandler<GenerateEpisodePayload> = async (job) => {
  const { episode_id } = job.data;

  try {
    await logJobProgress(job.id as string, 'generate-episode', 'Starting episode generation', 0, { episode_id });

    // Mock generation process - replace with actual AI generation logic
    for (let i = 0; i <= 100; i += 10) {
      await logJobProgress(job.id as string, 'generate-episode', `Generating episode... ${i}%`, i, { episode_id });
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
    }

    await logJobProgress(job.id as string, 'generate-episode', 'Episode generation completed', 100, { episode_id });
    console.log(`Completed episode generation for: ${episode_id}`);

  } catch (error) {
    await logJobProgress(job.id as string, 'generate-episode', `Generation failed: ${error}`, 0, { episode_id, error: error.message });
    throw error;
  }
};

// Helper function to download file from signed URL
const downloadFile = (url: string, filepath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filepath);
    https.get(url, (response: any) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err: Error) => {
        fsSync.unlink(filepath, () => {}) // Delete partial file
        reject(err);
      });
    }).on('error', (err: Error) => {
      fsSync.unlink(filepath, () => {}) // Delete partial file
      reject(err);
    });
  });
};

export const renderEpisodeHandler: JobHandler<RenderEpisodePayload> = async (job) => {
  const { render_id } = job.data
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

  try {
    await logJobProgress(job.id as string, 'render-episode', 'Starting video rendering', 0, { render_id })

    // Get render details
    const { data: render, error: renderError } = await supabase
      .from('renders')
      .select(`
        id,
        episode_id,
        status,
        episodes (
          id,
          series_id,
          timeline,
          series (
            brand_id,
            brands (
              user_id
            )
          )
        )
      `)
      .eq('id', render_id)
      .single()

    if (renderError || !render) {
      throw new Error(`Failed to fetch render: ${renderError?.message}`)
    }

    const episode = render.episodes as any
    const series = episode.series as any
    const brand = series.brands as any
    const user_id = brand.user_id

    await logJobProgress(job.id as string, 'render-episode', 'Fetched render metadata', 5, { render_id })

    // Get episode scenes
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('*')
      .eq('episode_id', episode.id)
      .order('idx')

    if (scenesError) {
      throw new Error(`Failed to fetch scenes: ${scenesError.message}`)
    }

    await logJobProgress(job.id as string, 'render-episode', 'Fetched episode scenes', 10, { scene_count: scenes?.length })

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', render_id)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Download assets with signed URLs
      const assetDownloadPromises = scenes?.map(async (scene, index) => {
        const assetPath = path.join(tempDir, `scene_${index}.mp4`)
        // Assuming src contains storage path, create signed URL
        const { data: signedUrl } = await supabase.storage
          .from('assets')
          .createSignedUrl(scene.src, 3600) // 1 hour expiry

        if (signedUrl) {
          await downloadFile(signedUrl.signedUrl, assetPath)
        }
        return { scene, assetPath }
      }) || []

      const assets = await Promise.all(assetDownloadPromises)
      await logJobProgress(job.id as string, 'render-episode', 'Downloaded assets', 25, { render_id })

      // Download SRT subtitles
      const srtPath = path.join(tempDir, 'subtitles.srt')
      const { data: srtSignedUrl } = await supabase.storage
        .from('subtitles')
        .createSignedUrl(`${episode.id}.srt`, 3600)

      if (srtSignedUrl) {
        await downloadFile(srtSignedUrl.signedUrl, srtPath)
      }

      await logJobProgress(job.id as string, 'render-episode', 'Downloaded subtitles', 30, { render_id })

      // Build FFmpeg filter complex for pan/zoom and ducking
      const filterComplex = buildFFmpegFilterComplex(assets, srtPath)

      // Set FFmpeg path
      ffmpeg.setFfmpegPath(config.FFMPEG_PATH)

      // Build FFmpeg command
      let ffmpegCommand = ffmpeg()

      // Add all input files
      assets.forEach(({ assetPath }) => {
        ffmpegCommand = ffmpegCommand.input(assetPath)
      })

      // Add subtitle input if SRT exists
      if (fsSync.existsSync(srtPath)) {
        ffmpegCommand = ffmpegCommand.input(srtPath)
      }

      const outputPath = path.join(tempDir, 'output.mp4')

      const promise = new Promise<void>((resolve, reject) => {
        ffmpegCommand
          .complexFilter(filterComplex)
          .videoCodec('libx264')
          .audioCodec('aac')
          .audioBitrate('192k')
          .size('1080x1920')
          .videoBitrate('8000k') // Will be overridden by CRF
          .outputOptions([
            '-crf 20',
            '-keyint_min 48',
            '-g 48',
            '-preset medium',
            '-pix_fmt yuv420p',
            '-movflags +faststart'
          ])
          .on('progress', (progress) => {
            const percentage = Math.round(progress.percent)
            logJobProgress(job.id as string, 'render-episode', `Rendering progress: ${percentage}%`, 30 + percentage * 0.6, { render_id })
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath)
      })

      await promise

      await logJobProgress(job.id as string, 'render-episode', 'FFmpeg rendering completed', 90, { render_id })

      // Get file stats
      const stats = await fs.stat(outputPath)
      const size_mb = stats.size / (1024 * 1024)

      // Get bitrate info
      const { stdout } = await execAsync(`"${config.FFPROBE_PATH}" -v quiet -print_format json -show_streams "${outputPath}"`)
      const probeData = JSON.parse(stdout)
      const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video')
      const bitrate = videoStream.bit_rate ? parseInt(videoStream.bit_rate) : null

      // Upload to storage
      const uploadPath = `${user_id}/${episode.id}.mp4`
      const fileBuffer = await fs.readFile(outputPath)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('renders')
        .upload(uploadPath, fileBuffer, {
          contentType: 'video/mp4',
          upsert: true
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('renders')
        .getPublicUrl(uploadPath)

      // Update renders table
      const { error: updateError } = await supabase
        .from('renders')
        .update({
          status: 'completed',
          url: publicUrl.publicUrl,
          size_mb,
          bitrate
        })
        .eq('id', render_id)

      if (updateError) {
        throw new Error(`Failed to update renders table: ${updateError.message}`)
      }

      await logJobProgress(job.id as string, 'render-episode', 'Video rendering completed', 100, { render_id, size_mb, bitrate })

      // Cleanup temp files
      await fs.rm(tempDir, { recursive: true, force: true })

      console.log(`Completed video rendering for: ${render_id}`)

    } catch (error) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw error
    }

  } catch (error) {
    // Update render status to failed
    await supabase
      .from('renders')
      .update({ status: 'failed' })
      .eq('id', render_id)
      .catch(() => {}) // Ignore errors during failure cleanup

    await logJobProgress(job.id as string, 'render-episode', `Rendering failed: ${error}`, 0, { render_id, error: error.message })
    throw error
  }
}

// Build complex FFmpeg filter for pan/zoom and ducking
function buildFFmpegFilterComplex(assets: any[], srtPath: string): string {
  const filters = []

  // Input labels
  let inputCount = assets.length
  const srtInput = fsSync.existsSync(srtPath) ? 1 : 0

  // Build filter complex based on scenes
  const videoFilters = assets.map((asset, index) => {
    const { scene } = asset
    let filter = `[${index}:v]`

    // Apply pan/zoom if specified
    if (scene.pan_zoom) {
      // Parse pan_zoom string (assuming format like "zoom,pad=1920:1080:210:0,scale=1920:1080")
      filter += scene.pan_zoom
    }

    filter += `setpts=PTS-STARTPTS[${index}v]`
    return filter
  })

  // Audio ducking with sidechaincompress
  const audioFilters = assets.map((asset, index) => {
    const { scene } = asset
    return `[${index}:a]asplit=2[${index}a_comp][${index}a_side]`
  }).join(';')

  // Sidechain compression for ducking music during speech
  const compressedAudio = assets.map((asset, index) => {
    return `[${index}a_side]sidechaincompress=threshold=0.4:ratio=8:attack=20:release=200:makeup=0.5:level_sc=0.6[${index}a_compressed]`
  }).join('')

  // Combine audio
  const combinedAudio = assets.map((asset, index) => `${index}a_compressed`).join('')
  const finalAudio = combinedAudio.length > 0 ? `[${combinedAudio}]amix=inputs=${assets.length}:duration=longest[aout]` : ''

  // Concatenate video streams
  const videoConcat = videoFilters.map((_, index) => `[${index}v]`).join('')
  const finalVideo = `${videoConcat}concat=n=${assets.length}:v=1:a=0[vout]`

  // Add subtitles
  let subtitleFilter = ''
  if (srtInput) {
    subtitleFilter = `[vout]subtitles=f=${srtPath}:force_style='FontSize=24,FontName=Arial'`
  } else {
    subtitleFilter = '[vout]'
  }

  return [
    ...videoFilters,
    audioFilters,
    compressedAudio,
    finalAudio,
    finalVideo,
    subtitleFilter
  ].filter(f => f).join(';')
}


export const publishVideoHandler: JobHandler<PublishVideoPayload> = async (job) => {
  const { episode_id, platform } = job.data

  try {
    await logJobProgress(job.id as string, 'publish-video', `Starting video publish to ${platform}`, 0, { episode_id, platform })

    // Mock publishing process - replace with actual social media API calls
    await logJobProgress(job.id as string, 'publish-video', `Publishing to ${platform}...`, 50, { episode_id, platform })

    // Simulate platform-specific publishing logic
    switch (platform) {
      case 'youtube':
        await new Promise(resolve => setTimeout(resolve, 2000)) // YouTube upload simulation
        break
      case 'tiktok':
        await new Promise(resolve => setTimeout(resolve, 1500))
        break
      case 'instagram':
        await new Promise(resolve => setTimeout(resolve, 1000))
        break
      case 'twitter':
        await new Promise(resolve => setTimeout(resolve, 800))
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    await logJobProgress(job.id as string, 'publish-video', `Video published successfully to ${platform}`, 100, { episode_id, platform })
    console.log(`Completed video publish for ${episode_id} to ${platform}`)

  } catch (error) {
    await logJobProgress(job.id as string, 'publish-video', `Publish failed: ${error}`, 0, { episode_id, platform, error: error.message })
    throw error
  }
}

// Register consumers with pg-boss
export async function registerConsumers() {
  const boss = await getPGBoss()

  // Configure queue options
  const queueOptions = {
    retryLimit: 3,
    retryDelay: 30 * 1000,
    retryBackoff: true,
    removeOnComplete: 600, // Remove completed jobs after 10 minutes
    removeOnFail: 3600, // Remove failed jobs after 1 hour
  }

  // Register workers for each queue
  await boss.work('generate-episode', generateEpisodeHandler, {
    ...queueOptions,
    retryLimit: 5, // More retries for generation
  })

  await boss.work('render-episode', renderEpisodeHandler, queueOptions)

  await boss.work('publish-video', publishVideoHandler, {
    ...queueOptions,
    retryLimit: 2, // Fewer retries for publishing
  })

  console.log('All job consumers registered successfully')
}
