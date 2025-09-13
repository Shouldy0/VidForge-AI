import { NextResponse } from 'next/server'
import { authenticateUser, supabase } from '@/lib/supabase'

type RouteParams = {
  params: {
    scheduleId: string
  }
}

// GET /api/schedules/[scheduleId] - Get a specific schedule
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId, error: userError } = await authenticateUser(request)
    if (userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scheduleId = params.scheduleId

    // Get the schedule with related series data
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select(`
        *,
        series (
          id,
          title,
          status,
          brand_id,
          brands(user_id),
          episodes (
            id,
            title,
            status,
            created_at
          )
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (scheduleError) {
      if (scheduleError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Schedule not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Failed to fetch schedule' },
        { status: 500 }
      )
    }

    // Verify user can access this schedule's series
    if (!schedule.series ||
        !schedule.series.brands ||
        schedule.series.brands.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ schedule })

  } catch (error) {
    console.error('Schedule GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/schedules/[scheduleId] - Update a schedule
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { userId, error: userError } = await authenticateUser(request)
    if (userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scheduleId = params.scheduleId
    const body = await request.json()
    const { cron_expr, timezone } = body

    // Validate cron expression format if provided
    if (cron_expr && cron_expr.split(' ').length !== 5) {
      return NextResponse.json(
        { error: 'Invalid cron expression format' },
        { status: 400 }
      )
    }

    // Verify user owns the schedule
    const { data: existingSchedule, error: verifyError } = await supabase
      .from('schedules')
      .select(`
        *,
        series (
          brand_id,
          brands(user_id)
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (verifyError || !existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (!existingSchedule.series ||
        !existingSchedule.series.brands ||
        existingSchedule.series.brands.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update the schedule
    const updates: any = {}
    if (cron_expr) updates.cron_expr = cron_expr
    if (timezone) updates.timezone = timezone

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', scheduleId)
      .select()
      .single()

    if (scheduleError) {
      console.error('Error updating schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ schedule })

  } catch (error) {
    console.error('Schedule PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/schedules/[scheduleId] - Delete a schedule
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId, error: userError } = await authenticateUser(request)
    if (userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scheduleId = params.scheduleId

    // Verify user owns the schedule before deleting
    const { data: existingSchedule, error: verifyError } = await supabase
      .from('schedules')
      .select(`
        *,
        series (
          brand_id,
          brands(user_id)
        )
      `)
      .eq('id', scheduleId)
      .single()

    if (verifyError || !existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (!existingSchedule.series ||
        !existingSchedule.series.brands ||
        existingSchedule.series.brands.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the schedule
    const { error: deleteError } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId)

    if (deleteError) {
      console.error('Error deleting schedule:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Schedule DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
