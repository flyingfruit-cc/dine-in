import { describe, it, expect } from 'vitest'
import { isItemAvailable } from '@/utils/isAvailable'
import type { AvailabilitySchedule } from '@/types/app'

const monFri: AvailabilitySchedule = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  start_time: '11:00',
  end_time: '14:00',
}

// Helpers: create a Date with a specific weekday + time
// JS Date.getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
function makeDate(jsDay: number, hours: number, minutes: number): Date {
  const d = new Date(2026, 0, 1) // arbitrary Thursday Jan 1 2026 (jsDay=4)
  // Shift to desired weekday
  const current = d.getDay()
  d.setDate(d.getDate() + ((jsDay - current + 7) % 7))
  d.setHours(hours, minutes, 0, 0)
  return d
}

describe('isItemAvailable', () => {
  it('returns true when schedule is null (always available)', () => {
    expect(isItemAvailable(null)).toBe(true)
  })

  it('returns false when days array is empty', () => {
    const schedule: AvailabilitySchedule = { days: [], start_time: '09:00', end_time: '17:00' }
    expect(isItemAvailable(schedule, makeDate(1, 12, 0))).toBe(false)
  })

  it('returns false when current day is not in schedule', () => {
    // Saturday (jsDay=6) not in Mon-Fri schedule
    expect(isItemAvailable(monFri, makeDate(6, 12, 0))).toBe(false)
  })

  it('returns false when time is before start_time', () => {
    // Monday, 10:59 — before 11:00
    expect(isItemAvailable(monFri, makeDate(1, 10, 59))).toBe(false)
  })

  it('returns true when time equals start_time (inclusive)', () => {
    // Monday, 11:00 — exactly at start
    expect(isItemAvailable(monFri, makeDate(1, 11, 0))).toBe(true)
  })

  it('returns true when time is within the window', () => {
    // Wednesday, 12:30 — midday
    expect(isItemAvailable(monFri, makeDate(3, 12, 30))).toBe(true)
  })

  it('returns false when time equals end_time (exclusive)', () => {
    // Friday, 14:00 — exactly at end (half-open interval)
    expect(isItemAvailable(monFri, makeDate(5, 14, 0))).toBe(false)
  })

  it('returns false when time is after end_time', () => {
    // Thursday, 15:00 — after window
    expect(isItemAvailable(monFri, makeDate(4, 15, 0))).toBe(false)
  })

  it('returns true for Sunday schedule on a Sunday', () => {
    const sunOnly: AvailabilitySchedule = { days: ['sun'], start_time: '10:00', end_time: '20:00' }
    expect(isItemAvailable(sunOnly, makeDate(0, 12, 0))).toBe(true)
  })

  it('returns false for Sunday schedule on a Monday', () => {
    const sunOnly: AvailabilitySchedule = { days: ['sun'], start_time: '10:00', end_time: '20:00' }
    expect(isItemAvailable(sunOnly, makeDate(1, 12, 0))).toBe(false)
  })

  it('handles midnight start (00:00)', () => {
    const allDay: AvailabilitySchedule = { days: ['mon'], start_time: '00:00', end_time: '23:59' }
    expect(isItemAvailable(allDay, makeDate(1, 0, 0))).toBe(true)
    expect(isItemAvailable(allDay, makeDate(1, 23, 58))).toBe(true)
    expect(isItemAvailable(allDay, makeDate(1, 23, 59))).toBe(false) // exclusive end
  })

  it('uses current time as default when now is omitted', () => {
    // Just verify it does not throw and returns a boolean
    expect(typeof isItemAvailable(null)).toBe('boolean')
    expect(typeof isItemAvailable(monFri)).toBe('boolean')
  })
})
