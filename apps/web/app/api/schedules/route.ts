import { NextResponse } from 'next/server'
import { authenticateUser, supabase } from '@/lib/supabase'

// GET /api/schedules - Get all schedules for current user
export async function GET(request: Request) {
  try {
    const { userId, error: userError } = await authenticateUser(request)
    if (userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all series owned by the user
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select('id, brand_id, brands(user_id)')
      .eq('brands.user_id', userId)

    if (seriesError) {
      console.error('Error fetching user series:', seriesError)
      return NextResponse.json(
        { error: 'Failed to fetch user series' },
        { status: 500 }
      )
    }

    const seriesIds = seriesData?.map(s => s.id) || []

    if (seriesIds.length === 0) {
      return NextResponse.json({ schedules: [] })
    }

    // Get schedules for these series
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select(`
        *,
        series (
          id,
          title,
          status,
          episodes (
            id,
            title,
            status,
            created_at
          )
        )
      `)
      .in('series_id', seriesIds)
      .order('created_at', { ascending: false })

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError)
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ schedules: schedules || [] })

  } catch (error) {
    console.error('Schedules GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/schedules - Create a new schedule
export async function POST(request: Request) {
  try {
    const { userId, error: userError } = await authenticateUser(request)
    if (userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { series_id, cron_expr, timezone = 'UTC' } = body

    // Validate required fields
    if (!series_id || !cron_expr) {
      return NextResponse.json(
        { error: 'Missing required fields: series_id, cron_expr' },
        { status: 400 }
      )
    }

    // Validate cron expression format (basic check)
    if (cron_expr.split(' ').length !== 5) {
      return NextResponse.json(
        { error: 'Invalid cron expression format' },
        { status: 400 }
      )
    }

    // Verify user owns the series
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select(`
        id,
        brand_id,
        brands(user_id)
      `)
      .eq('id', series_id)
      .single()

    if (seriesError || !seriesData) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      )
    }

    if (seriesData.brand_id !== seriesData.brands?.user_id &&
        seriesData.brands?.user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Create the schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        series_id,
        cron_expr,
        timezone
      })
      .select()
      .single()

    if (scheduleError) {
      console.error('Error creating schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Failed to create schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ schedule }, { status: 201 })

  } catch (error) {
    console.error('Schedules POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
