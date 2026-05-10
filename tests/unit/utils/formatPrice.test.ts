import { describe, it, expect } from 'vitest'
import { formatPrice } from '@/utils/formatPrice'

describe('formatPrice', () => {
  it('formats whole dollar amounts', () => {
    expect(formatPrice(1500)).toBe('$15.00')
  })

  it('formats cents-only amounts', () => {
    expect(formatPrice(99)).toBe('$0.99')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('formats amounts with cents', () => {
    expect(formatPrice(1099)).toBe('$10.99')
  })

  it('formats large amounts', () => {
    expect(formatPrice(10000)).toBe('$100.00')
  })

  it('pads single-digit cents', () => {
    expect(formatPrice(501)).toBe('$5.01')
  })
})
