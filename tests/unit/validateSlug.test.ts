import { describe, it, expect } from 'vitest'
import { isValidSlugFormat } from '@/utils/validateSlug'

describe('isValidSlugFormat', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlugFormat('abc')).toBe(true)
    expect(isValidSlugFormat('my-restaurant')).toBe(true)
    expect(isValidSlugFormat('burger123')).toBe(true)
    expect(isValidSlugFormat('a'.repeat(50))).toBe(true)
  })

  it('rejects slugs shorter than 3 characters', () => {
    expect(isValidSlugFormat('ab')).toBe(false)
    expect(isValidSlugFormat('a')).toBe(false)
    expect(isValidSlugFormat('')).toBe(false)
  })

  it('rejects slugs longer than 50 characters', () => {
    expect(isValidSlugFormat('a'.repeat(51))).toBe(false)
  })

  it('rejects uppercase letters', () => {
    expect(isValidSlugFormat('MyRestaurant')).toBe(false)
    expect(isValidSlugFormat('BURGER')).toBe(false)
  })

  it('rejects spaces and special characters', () => {
    expect(isValidSlugFormat('my restaurant')).toBe(false)
    expect(isValidSlugFormat('my_restaurant')).toBe(false)
    expect(isValidSlugFormat('my.restaurant')).toBe(false)
    expect(isValidSlugFormat('my@restaurant')).toBe(false)
  })

  it('accepts hyphens as separators', () => {
    expect(isValidSlugFormat('my-great-restaurant')).toBe(true)
    expect(isValidSlugFormat('a-b-c')).toBe(true)
  })

  it('rejects leading, trailing, and consecutive hyphens', () => {
    expect(isValidSlugFormat('-abc')).toBe(false)
    expect(isValidSlugFormat('abc-')).toBe(false)
    expect(isValidSlugFormat('a--b')).toBe(false)
    expect(isValidSlugFormat('---')).toBe(false)
    expect(isValidSlugFormat('--abc')).toBe(false)
  })
})
