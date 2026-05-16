import type { AvailabilitySchedule, DayOfWeek } from '@/types/app'

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

// Half-open interval [start_time, end_time). Overnight schedules (start > end) are not supported.
export function isItemAvailable(
  schedule: AvailabilitySchedule | null,
  now = new Date()
): boolean {
  if (!schedule) return true
  if (!schedule.days.length) return false

  const dayOfWeek = DAY_MAP[now.getDay()]
  if (!schedule.days.includes(dayOfWeek)) return false

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  return currentTime >= schedule.start_time && currentTime < schedule.end_time
}
