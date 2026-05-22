import { describe, it, expect } from 'vitest'
import { resolveLanguage } from '@/utils/resolveLanguage'

const SUPPORTED = ['en', 'es', 'fr']

describe('resolveLanguage', () => {
  it('returns URL lang when valid and in supported set', () => {
    const result = resolveLanguage({
      urlLang: 'es',
      supportedLanguages: SUPPORTED,
      defaultLanguage: 'en',
    })
    expect(result).toBe('es')
  })

  it('ignores URL lang when not in supported set', () => {
    const result = resolveLanguage({
      urlLang: 'ja',
      supportedLanguages: SUPPORTED,
      defaultLanguage: 'en',
    })
    expect(result).toBe('en')
  })

  it('ignores URL lang that is not a known AllowedLanguage', () => {
    const result = resolveLanguage({
      urlLang: 'de',
      supportedLanguages: ['en', 'de'],
      defaultLanguage: 'en',
    })
    expect(result).toBe('en')
  })

  it('falls back to default_language when URL lang is empty', () => {
    const result = resolveLanguage({
      urlLang: undefined,
      supportedLanguages: SUPPORTED,
      defaultLanguage: 'es',
    })
    expect(result).toBe('es')
  })

  it('default_language wins regardless of any browser preference (no Accept-Language consulted)', () => {
    // This is the key behavior change: the owner's default is authoritative
    // for QR scans. There is no auto-detection from browser locale.
    const result = resolveLanguage({
      urlLang: undefined,
      supportedLanguages: ['en', 'ja'],
      defaultLanguage: 'en',
    })
    expect(result).toBe('en')
  })

  it('URL lang still overrides default', () => {
    const result = resolveLanguage({
      urlLang: 'ja',
      supportedLanguages: ['en', 'ja'],
      defaultLanguage: 'en',
    })
    expect(result).toBe('ja')
  })

  it('falls back to en when defaultLanguage is malformed', () => {
    const result = resolveLanguage({
      urlLang: undefined,
      supportedLanguages: SUPPORTED,
      defaultLanguage: 'de',
    })
    expect(result).toBe('en')
  })

  it('treats empty-string URL lang the same as missing', () => {
    const result = resolveLanguage({
      urlLang: '',
      supportedLanguages: SUPPORTED,
      defaultLanguage: 'fr',
    })
    expect(result).toBe('fr')
  })
})
