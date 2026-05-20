import { describe, it, expect } from 'vitest'
import { parsePeriodParam } from '@/app/admin/analytics/page'

describe('parsePeriodParam', () => {
  it('accepts "today"', () => expect(parsePeriodParam('today')).toBe('today'))
  it('accepts "7d"', () => expect(parsePeriodParam('7d')).toBe('7d'))
  it('accepts "30d"', () => expect(parsePeriodParam('30d')).toBe('30d'))
  it('accepts "90d"', () => expect(parsePeriodParam('90d')).toBe('90d'))

  it('falls back to "7d" for unknown string', () =>
    expect(parsePeriodParam('60d')).toBe('7d'))
  it('falls back to "7d" for empty string', () =>
    expect(parsePeriodParam('')).toBe('7d'))
  it('falls back to "7d" for undefined', () =>
    expect(parsePeriodParam(undefined)).toBe('7d'))
  it('falls back to "7d" for SQL injection-style string', () =>
    expect(parsePeriodParam("'; DROP TABLE orders; --")).toBe('7d'))
})
