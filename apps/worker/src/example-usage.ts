#!/usr/bin/env ts-node-esm

/**
 * Example usage of pg-boss job queues
 * This file demonstrates how to create jobs and process them
 */

import 'dotenv/config'
import { initializePGBoss, closePGBoss } from './index'
import { registerConsumers } from './consumers'
import { createGenerateEpisodeJob, createRenderEpisodeJob, createPublishVideoJob, createEpisodeProcessingPipeline } from './producers'

async function main() {
  try {
    console.log('Initializing pg-boss...')
    await initializePGBoss()

    console.log('Registering consumers...')
    await registerConsumers()

    // Example 1: Create individual jobs
    console.log('\n=== Creating individual jobs ===')

    const generateJobId = await createGenerateEpisodeJob({
      episode_id: 'ep-12345'
    })
    console.log(`Generate job created: ${generateJobId}`)

    const renderJobId = await createRenderEpisodeJob({
      render_id: 'render-67890'
    })
    console.log(`Render job created: ${renderJobId}`)

    const publishJobId = await createPublishVideoJob({
      episode_id: 'ep-12345',
      platform: 'youtube'
    })
    console.log(`Publish job created: ${publishJobId}`)

    // Example 2: Create episode processing pipeline
    console.log('\n=== Creating episode processing pipeline ===')

    const pipeline = await createEpisodeProcessingPipeline('ep-67890')
    console.log('Pipeline created:', pipeline)

    // Example 3: Create multiple publish jobs for different platforms
    console.log('\n=== Creating publish jobs for multiple platforms ===')

    const platforms: Array<'youtube' | 'tiktok' | 'instagram' | 'twitter'> = ['youtube', 'tiktok', 'instagram']
    for (const platform of platforms) {
      const jobId = await createPublishVideoJob({
        episode_id: 'ep-99999',
        platform
      })
      console.log(`Publish job for ${platform}: ${jobId}`)
    }

    console.log('\n=== Jobs created successfully ===')
    console.log('Worker is now processing jobs. Press Ctrl+C to stop.')

      // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\nShutting down worker...')
      await closePGBoss()
      process.exit(0)
    })

  } catch (error) {
    console.error('Error in main:', error)
    await closePGBoss()
    process.exit(1)
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  main()
}
