/**
 * VidForge Worker - pg-boss job queue management
 * Main entry point for job processing system
 */

import PgBoss from 'pg-boss'

export interface JobQueues {
  'generate-episode': {
    payload: { episode_id: string }
  }
  'render-episode': {
    payload: { render_id: string }
  }
  'publish-video': {
    payload: { episode_id: string; platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter' }
  }
}

let boss: PgBoss | null = null

export async function initializePGBoss(): Promise<PgBoss> {
  if (boss) {
    return boss
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  boss = new PgBoss({
    connectionString,
    schema: 'jobs',
    application_name: 'vidforge-worker',
    max: 2,
    min: 1,
    monitorStateIntervalSeconds: 30,
  })

  boss.on('error', (error) => {
    console.error('PGBoss error:', error)
  })

  boss.on('monitor-states', (states) => {
    console.log('Job states:', states)
  })

  await boss.start()
  console.log('pg-boss started successfully')

  return boss
}

export async function getPGBoss(): Promise<PgBoss> {
  if (!boss) {
    throw new Error('PGBoss not initialized. Call initializePGBoss() first.')
  }
  return boss
}

export async function closePGBoss(): Promise<void> {
  if (boss) {
    await boss.stop()
    boss = null
  }
}

// Re-export all producer and consumer functions for convenience
export * from './producers'
export * from './consumers'
