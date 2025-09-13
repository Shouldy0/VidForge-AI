import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting scheduler execution...')

    // Get all active schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select(`
        id,
        series_id,
        cron_expr,
        timezone,
        series (
          id,
          title,
          cadence,
          status,
          episodes (
            id,
            status,
            created_at,
            title,
            renders!inner (
              status,
              url
            )
          )
        )
      `)

    if (schedulesError) {
      throw new Error(`Failed to fetch schedules: ${schedulesError.message}`)
    }

    const now = new Date()
    const dueEpisodes: any[] = []
    const scheduleJobs: any[] = []

    console.log(`Found ${schedules?.length || 0} schedules to check`)

    // Process each schedule
    for (const schedule of schedules || []) {
      try {
        const { cron_expr, timezone, series } = schedule

        if (!series) {
          console.warn(`Schedule ${schedule.id} has no associated series`)
          continue
        }

        // Skip disabled series
        if (series.status === 'DISABLED' || series.status === 'PAUSED') {
          console.log(`Skipping schedule for disabled series: ${series.title}`)
          continue
        }

        console.log(`Processing schedule for series "${series.title}" with cron: ${cron_expr}`)

        // Parse cron expression and find next due episode
        const isDue = checkIfScheduleIsDue(cron_expr, timezone, now)

        if (isDue) {
          console.log(`Schedule is due. Finding publishable episodes...`)

          // Find episodes that are ready to publish (have completed render but no published status)
          const readyEpisodes = (series.episodes || []).filter((episode: any) =>
            episode.status === 'COMPLETED' || episode.status === 'RENDERED'
          )

          console.log(`Found ${readyEpisodes.length} ready episodes`)

          for (const episode of readyEpisodes) {
            // Double-check that it has a completed render
            const hasCompletedRender = (episode.renders || []).some((render: any) =>
              render.status === 'completed' && render.url
            )

            if (hasCompletedRender) {
              dueEpisodes.push({
                episode_id: episode.id,
                series_title: series.title,
                episode_title: episode.title,
                created_at: episode.created_at,
                schedule_id: schedule.id
              })

              // Queue publish jobs for this episode
              scheduleJobs.push({
                episode_id: episode.id,
                schedule_id: schedule.id,
                platforms: ['youtube'], // Default platforms, can be configurable later
                series_id: series.id
              })
            }
          }
        } else {
          console.log(`Schedule not due yet`)
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error)
      }
    }

    console.log(`Found ${dueEpisodes.length} due episodes to process`)

    // Enqueue jobs for each due episode
    const jobIds: string[] = []

    for (const job of scheduleJobs) {
      try {
        console.log(`Creating publish job for episode ${job.episode_id}`)

        // For each platform
        for (const platform of job.platforms) {
          const publishPayload = {
            episode_id: job.episode_id,
            platform: platform,
            series_id: job.series_id,
            scheduled: true
          }

          // Call the Edge Function to enqueue the job
          const response = await fetch(`${supabaseUrl}/functions/v1/publish-${platform}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              episode_id: job.episode_id,
              title: `${job.episode_title || 'Episode'} - ${job.series_title || 'VidForge'}`,
              description: `Automated publish from VidForge scheduler`,
              tags: ['VidForge', 'AI', 'Video'],
              visibility: 'private' // Default to private for safety
            })
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success) {
              jobIds.push(result.videoId || `scheduled-${job.episode_id}-${platform}`)
              console.log(`Successfully scheduled publish job for episode ${job.episode_id} to ${platform}`)
            } else {
              console.error(`Failed to publish episode ${job.episode_id} to ${platform}:`, result.error)
            }
          } else {
            const errorText = await response.text()
            console.error(`Failed to call publish-${platform}:`, errorText)
          }
        }
      } catch (error) {
        console.error(`Error creating job for episode ${job.episode_id}:`, error)
      }
    }

    const summary = {
      checked_schedules: schedules?.length || 0,
      due_episodes: dueEpisodes.length,
      jobs_created: jobIds.length,
      job_ids: jobIds,
      executed_at: now.toISOString()
    }

    console.log('Scheduler execution completed:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        ...summary
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Scheduler execution failed',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Simple cron expression parser for basic patterns
function checkIfScheduleIsDue(cronExpr: string, timezone: string, now: Date): boolean {
  try {
    // Convert to target timezone
    const targetNow = new Date(now.toLocaleString("en-US", {timeZone: timezone}))

    // Parse basic cron patterns (minute hour day month weekday)
    // Example cron expressions: "0 9 * * 1" (9 AM every Monday)
    // For now, support simple patterns
    const parts = cronExpr.split(' ')
    if (parts.length !== 5) {
      console.warn(`Invalid cron expression: ${cronExpr}`)
      return false
    }

    const [minute, hour, day, month, weekday] = parts

    // Check various formats - simplified implementation
    const nowMinute = targetNow.getMinutes()
    const nowHour = targetNow.getHours()
    const nowDay = targetNow.getDate()
    const nowMonth = targetNow.getMonth() + 1 // JavaScript months are 0-indexed
    const nowWeekday = targetNow.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Match minute (can be "*", "*/N", or specific number)
    if (!matchesCronField(minute, nowMinute, 0, 59)) return false

    // Match hour
    if (!matchesCronField(hour, nowHour, 0, 23)) return false

    // Match day of month (simplified - doesn't handle months with different day counts)
    if (!matchesCronField(day, nowDay, 1, 31)) return false

    // Match month
    if (!matchesCronField(month, nowMonth, 1, 12)) return false

    // Match weekday
    if (!matchesCronField(weekday, nowWeekday, 0, 6)) return false

    return true
  } catch (error) {
    console.error(`Error parsing cron expression "${cronExpr}":`, error)
    return false
  }
}

// Helper to match cron field (supports *, specific numbers, and */N patterns)
function matchesCronField(cronField: string, currentValue: number, min: number, max: number): boolean {
  if (cronField === '*') {
    return true
  }

  // Support for step values like "*/2" or "0/2"
  if (cronField.startsWith('*/')) {
    const step = parseInt(cronField.substring(2))
    return currentValue % step === 0
  }

  if (cronField.includes('/')) {
    const [start, step] = cronField.split('/')
    const startVal = start === '*' ? 0 : parseInt(start)
    const stepVal = parseInt(step)
    return (currentValue - startVal) % stepVal === 0
  }

  // Specific values or ranges
  if (cronField.includes('-')) {
    const [start, end] = cronField.split('-').map(n => parseInt(n))
    return currentValue >= start && currentValue <= end
  }

  // Comma-separated list
  if (cronField.includes(',')) {
    const values = cronField.split(',').map(n => n.trim())
    return values.includes(currentValue.toString())
  }

  // Single value
  const value = parseInt(cronField)
  return !isNaN(value) && value === currentValue
}
