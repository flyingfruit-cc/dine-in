import { describe, it, expect } from 'vitest'
import { formatChrome } from '@/utils/formatChrome'

describe('formatChrome', () => {
  it('substitutes named placeholders', () => {
    expect(formatChrome('Hello {name}', { name: 'World' })).toBe('Hello World')
  })

  it('substitutes multiple placeholders', () => {
    expect(
      formatChrome('{count} {itemWord} in cart', { count: 3, itemWord: 'items' }),
    ).toBe('3 items in cart')
  })

  it('leaves unknown placeholders intact for visible debugging', () => {
    expect(formatChrome('Hello {name}', {})).toBe('Hello {name}')
  })

  it('returns string unchanged when no placeholders', () => {
    expect(formatChrome('No placeholders', { foo: 'bar' })).toBe('No placeholders')
  })

  it('coerces numbers to strings', () => {
    expect(formatChrome('Total: {n}', { n: 42 })).toBe('Total: 42')
  })
})
