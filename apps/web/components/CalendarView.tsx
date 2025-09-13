'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { Schedule, Episode, Series } from '../../packages/shared/src/types'

// Combined status type for episodes shown in calendar
export interface CalendarEpisode {
  id: string
  title: string
  date: Date
  status: 'scheduled' | 'published' | 'failed'
  series_title: string
  series_id: string
  scheduled_cron?: string
}

interface CalendarViewProps {
  schedules: Schedule[]
  episodes: Episode[]
  series: Series[]
}

interface CalendarProps {
  events: CalendarEpisode[]
  onDateSelect?: (date: Date) => void
  onEventClick?: (event: CalendarEpisode) => void
}

export function CalendarView({ schedules, episodes, series }: CalendarViewProps) {
  // Generate calendar events from schedules and episodes
  const calendarEvents = useMemo(() => {
    const events: CalendarEpisode[] = []

    // Process each schedule to generate future dates
    schedules.forEach(schedule => {
      const seriesInfo = series.find(s => s.id === schedule.series_id)
      if (!seriesInfo) return

      // Generate dates for the next 3 months
      const futureDates = generateScheduleDates(schedule, 90)

      futureDates.forEach(date => {
        // Check if there's an episode published/completed around this date
        const relatedEpisode = episodes.find(episode =>
          episode.series_id === schedule.series_id &&
          new Date(episode.created_at).toDateString() === date.toDateString() &&
          (episode.status === 'COMPLETED' || episode.status === 'PUBLISHED')
        )

        const status: CalendarEpisode['status'] = relatedEpisode
          ? (relatedEpisode.status === 'PUBLISHED' ? 'published' : 'scheduled')
          : 'scheduled'

        events.push({
          id: `${schedule.id}-${date.toISOString().split('T')[0]}`,
          title: relatedEpisode ? relatedEpisode.title : `Scheduled: ${seriesInfo.title}`,
          date,
          status,
          series_title: seriesInfo.title,
          series_id: schedule.series_id,
          scheduled_cron: schedule.cron_expr
        })
      })
    })

    // Add published episodes without schedules
    episodes.forEach(episode => {
      const seriesInfo = series.find(s => s.id === episode.series_id)
      if (!seriesInfo) return

      const episodeDate = new Date(episode.created_at)
      const existingEvent = events.find(
        e => e.series_id === episode.series_id &&
             e.date.toDateString() === episodeDate.toDateString()
      )

      if (!existingEvent && episode.status === 'PUBLISHED') {
        events.push({
          id: episode.id,
          title: episode.title,
          date: episodeDate,
          status: 'published',
          series_title: seriesInfo.title,
          series_id: episode.series_id
        })
      }
    })

    return events
  }, [schedules, episodes, series])

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Publishing Calendar</h2>
        <p className="text-sm text-gray-500 mt-1">
          View scheduled and published episodes by month
        </p>
      </div>
      <div className="p-4">
        <Calendar events={calendarEvents} />
      </div>
    </div>
  )
}

// Calendar component
function Calendar({ events }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const firstDayOfCalendar = new Date(firstDayOfMonth)
  firstDayOfCalendar.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  const days = []
  let day = new Date(firstDayOfCalendar)

  for (let i = 0; i < 42; i++) { // 6 weeks x 7 days
    days.push(new Date(day))
    day.setDate(day.getDate() + 1)
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getEventsForDay = (date: Date) => {
    return events.filter(event =>
      event.date.toDateString() === date.toDateString()
    )
  }

  return (
    <div className="w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
            setSelectedDate(null)
          }}
          className="p-1 hover:bg-gray-100 rounded-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
            setSelectedDate(null)
          }}
          className="p-1 hover:bg-gray-100 rounded-md"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = day.toDateString() === new Date().toDateString()
          const isSelected = selectedDate?.toDateString() === day.toDateString()

          return (
            <div
              key={index}
              className={`
                min-h-[80px] p-1 border rounded-md cursor-pointer hover:bg-gray-50
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isToday ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}
                ${isSelected ? 'ring-2 ring-blue-500' : ''}
              `}
              onClick={() => setSelectedDate(day)}
            >
              <div className="text-sm font-medium mb-1">
                {day.getDate()}
              </div>

              {/* Events for this day */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <EventIndicator key={event.id} event={event} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Events for {selectedDate.toLocaleDateString()}
          </h4>
          <div className="space-y-2">
            {getEventsForDay(selectedDate).map(event => (
              <EventDetail key={event.id} event={event} />
            ))}
            {getEventsForDay(selectedDate).length === 0 && (
              <p className="text-sm text-gray-500">No events scheduled for this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Event indicator for calendar cell
function EventIndicator({ event }: { event: CalendarEpisode }) {
  const statusConfig = {
    scheduled: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Clock
    },
    published: {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: CheckCircle
    },
    failed: {
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: XCircle
    }
  }

  const config = statusConfig[event.status]
  const Icon = config.icon

  return (
    <div className={`
      flex items-center gap-1 text-xs px-1 py-0.5 rounded border truncate max-w-full
      ${config.color}
    `}>
      <Icon className="w-3 h-3" />
      <span className="truncate">{event.series_title}</span>
    </div>
  )
}

// Detailed event view
function EventDetail({ event }: { event: CalendarEpisode }) {
  const statusConfig = {
    scheduled: {
      color: 'text-blue-800 bg-blue-100',
      icon: Clock,
      label: 'Scheduled'
    },
    published: {
      color: 'text-green-800 bg-green-100',
      icon: CheckCircle,
      label: 'Published'
    },
    failed: {
      color: 'text-red-800 bg-red-100',
      icon: XCircle,
      label: 'Failed'
    }
  }

  const config = statusConfig[event.status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 p-3 border rounded-md">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{event.title}</div>
        <div className="text-xs text-gray-500">{event.series_title}</div>
        {event.scheduled_cron && (
          <div className="text-xs text-gray-400">Cron: {event.scheduled_cron}</div>
        )}
      </div>
      <div className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </div>
    </div>
  )
}

// Generate future dates based on cron expression (simplified)
function generateScheduleDates(schedule: Schedule, daysAhead: number): Date[] {
  const dates: Date[] = []
  const now = new Date()
  const endDate = new Date(now)
  endDate.setDate(now.getDate() + daysAhead)

  // Simple daily/weekly monthly patterns
  const [minute, hour, day, month, weekday] = schedule.cron_expr.split(' ')

  let current = new Date(now)

  // For the next N days, check if each day matches the cron
  for (let d = 0; d < daysAhead; d++) {
    const checkDate = new Date(now)
    checkDate.setDate(now.getDate() + d)

    let matches = true

    // Check weekday if specified
    if (weekday !== '*' && weekday !== '?') {
      if (!checkCronField(weekday, checkDate.getDay())) {
        matches = false
      }
    }

    // Check day of month if specified and not *
    if (day !== '*' && day !== '?') {
      if (!checkCronField(day, checkDate.getDate())) {
        matches = false
      }
    }

    // For now, just do simple patterns:
    // "0 9 * * 1" = Mondays at 9 AM
    // "0 14 * * 5" = Fridays at 2 PM
    // "*" patterns run every day
    // */2 patterns run every other day/week

    const isWildcard = day === '*' || day.startsWith('*/')
    const isMonday = checkDate.getDay() === 1

    if (isWildcard || (weekday === '1' && isMonday)) {
      dates.push(checkDate)

      // Limit to reasonable number of events per series
      if (dates.length >= 10) break
    }
  }

  return dates
}

// Simple cron field matcher
function checkCronField(field: string, value: number): boolean {
  if (field === '*') return true
  if (field.startsWith('*/')) {
    const divisor = parseInt(field.substring(2))
    return value % divisor === 0
  }
  return parseInt(field) === value
}
