'use client'

import type { AvailabilitySchedule as Schedule, DayOfWeek } from '@/types/app'

interface Props {
  schedule: Schedule | null
  onChange: (schedule: Schedule | null) => void
}

const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const DEFAULT_SCHEDULE: Schedule = { days: [], start_time: '09:00', end_time: '17:00' }

export function AvailabilitySchedule({ schedule, onChange }: Props) {
  const enabled = schedule !== null

  const toggleEnabled = () => {
    onChange(enabled ? null : { ...DEFAULT_SCHEDULE })
  }

  const toggleDay = (day: DayOfWeek) => {
    if (!schedule) return
    const days = schedule.days.includes(day)
      ? schedule.days.filter((d) => d !== day)
      : [...schedule.days, day]
    onChange({ ...schedule, days })
  }

  const handleStartTime = (value: string) => {
    if (!schedule || !value) return
    onChange({ ...schedule, start_time: value })
  }

  const handleEndTime = (value: string) => {
    if (!schedule || !value) return
    onChange({ ...schedule, end_time: value })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleEnabled}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        <span className="text-sm text-text-primary">Enable availability schedule</span>
      </label>

      {enabled && schedule && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
          {/* Day selector */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Available on
            </span>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map(({ key, label }) => {
                const active = schedule.days.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    aria-pressed={active}
                    className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent text-white'
                        : 'border border-border bg-transparent text-text-secondary hover:bg-surface'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time range */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">From</label>
                <input
                  type="time"
                  value={schedule.start_time}
                  onChange={(e) => handleStartTime(e.target.value)}
                  className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <span className="mt-5 text-sm text-text-tertiary">–</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary">Until</label>
                <input
                  type="time"
                  value={schedule.end_time}
                  onChange={(e) => handleEndTime(e.target.value)}
                  className="h-9 rounded-md border border-border bg-transparent px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            {schedule.start_time >= schedule.end_time && (
              <p role="alert" className="text-xs text-amber-600">
                Start time must be before end time
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
