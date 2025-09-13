import { getPGBoss } from './index'
import type { GenerateEpisodePayload, RenderEpisodePayload, PublishVideoPayload } from '@vidforge/shared'

// Job configuration with retry and backoff settings
const JOB_CONFIG = {
  retryLimit: 3,
  retryDelay: 30 * 1000, // 30 seconds
  retryBackoff: true,
  removeOnComplete: false,
  removeOnFail: false,
}

// Producer functions for each queue

export async function createGenerateEpisodeJob(payload: GenerateEpisodePayload): Promise<string> {
  const boss = await getPGBoss()
  const jobId = await boss.send('generate-episode', payload, {
    ...JOB_CONFIG,
    retryLimit: 5, // More retries for generation
    singletonKey: `generate-episode-${payload.episode_id}`, // Prevent duplicate jobs for same episode
  })
  console.log(`Created generate-episode job: ${jobId}`)
  return jobId
}

export async function createRenderEpisodeJob(payload: RenderEpisodePayload): Promise<string> {
  const boss = await getPGBoss()
  const jobId = await boss.send('render-episode', payload, {
    ...JOB_CONFIG,
    singletonKey: `render-episode-${payload.render_id}`,
  })
  console.log(`Created render-episode job: ${jobId}`)
  return jobId
}

export async function createPublishVideoJob(payload: PublishVideoPayload): Promise<string> {
  const boss = await getPGBoss()
  const jobId = await boss.send('publish-video', payload, {
    ...JOB_CONFIG,
    retryLimit: 2, // Fewer retries for publishing (social media APIs are simpler)
    singletonKey: `publish-video-${payload.episode_id}-${payload.platform}`,
  })
  console.log(`Created publish-video job: ${jobId}`)
  return jobId
}

// Utility to create chained jobs (generate -> render -> publish)
export async function createEpisodeProcessingPipeline(episodeId: string): Promise<{
  generateJob: string
  renderJob: string
  publishJob: string
}> {
  // Create generate job
  const generateJob = await createGenerateEpisodeJob({ episode_id: episodeId })

  // Create render job that depends on generate completion
  const renderJob = await createRenderEpisodeJob({ render_id: episodeId })

  // Create publish jobs for different platforms that depend on render completion
  const publishJob = await createPublishVideoJob({
    episode_id: episodeId,
    platform: 'youtube' // Default to YouTube
  })

  return {
    generateJob,
    renderJob,
    publishJob
  }
}
