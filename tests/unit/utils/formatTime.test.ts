import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/utils/formatTime'

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-18T14:00:00Z')

  it('returns "just now" when less than 1 minute ago', () => {
    expect(formatRelativeTime('2026-05-18T13:59:30Z', now)).toBe('just now')
  })

  it('returns "Xm ago" for minutes within the last 60 minutes', () => {
    expect(formatRelativeTime('2026-05-18T13:57:00Z', now)).toBe('3m ago')
    expect(formatRelativeTime('2026-05-18T13:15:00Z', now)).toBe('45m ago')
  })

  it('returns absolute clock time when older than 60 minutes', () => {
    const result = formatRelativeTime('2026-05-18T12:14:00Z', now)
    expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/)
  })

  it('treats exactly 60 minutes as relative ("60m ago")', () => {
    expect(formatRelativeTime('2026-05-18T13:00:00Z', now)).toBe('60m ago')
  })

  it('switches to absolute past 60 minutes', () => {
    const result = formatRelativeTime('2026-05-18T12:59:00Z', now)
    expect(result).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/)
  })
})
