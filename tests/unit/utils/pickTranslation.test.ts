import { describe, it, expect } from 'vitest'
import { pickTranslation } from '@/utils/pickTranslation'

describe('pickTranslation', () => {
  it('returns translation when present', () => {
    const result = pickTranslation(
      {
        name: 'Pizza',
        description: 'Cheese pizza',
        translations: { es: { name: 'Pizza ES', description: 'Pizza de queso' } },
      },
      'es',
    )
    expect(result).toEqual({ name: 'Pizza ES', description: 'Pizza de queso' })
  })

  it('falls back to default name when translation missing', () => {
    const result = pickTranslation(
      {
        name: 'Pizza',
        description: 'Cheese pizza',
        translations: {},
      },
      'es',
    )
    expect(result).toEqual({ name: 'Pizza', description: 'Cheese pizza' })
  })

  it('falls back when translation has empty-string name', () => {
    const result = pickTranslation(
      {
        name: 'Pizza',
        description: 'Default',
        translations: { es: { name: '   ', description: 'Pizza de queso' } },
      },
      'es',
    )
    expect(result.name).toBe('Pizza')
    expect(result.description).toBe('Pizza de queso')
  })

  it('handles description: null on default', () => {
    const result = pickTranslation({ name: 'Pizza', description: null }, 'en')
    expect(result).toEqual({ name: 'Pizza', description: null })
  })

  it('uses default description when translation description is empty/missing', () => {
    const result = pickTranslation(
      {
        name: 'Pizza',
        description: 'Default desc',
        translations: { es: { name: 'Pizza ES' } },
      },
      'es',
    )
    expect(result.name).toBe('Pizza ES')
    expect(result.description).toBe('Default desc')
  })

  it('handles translations field absent entirely', () => {
    const result = pickTranslation({ name: 'Pizza', description: 'Cheese' }, 'es')
    expect(result).toEqual({ name: 'Pizza', description: 'Cheese' })
  })

  it('handles description undefined on content', () => {
    const result = pickTranslation({ name: 'Pizza' }, 'en')
    expect(result.description).toBeNull()
  })
})
