import { describe, it, expect } from 'vitest'
import en from '@/i18n/en.json'
import es from '@/i18n/es.json'
import fr from '@/i18n/fr.json'
import ja from '@/i18n/ja.json'
import zh from '@/i18n/zh.json'

const bundles = [
  { code: 'es', data: es as Record<string, string> },
  { code: 'fr', data: fr as Record<string, string> },
  { code: 'ja', data: ja as Record<string, string> },
  { code: 'zh', data: zh as Record<string, string> },
]

const englishKeys = Object.keys(en as Record<string, string>).sort()

describe('i18n bundles', () => {
  it('English bundle has at least one key', () => {
    expect(englishKeys.length).toBeGreaterThan(0)
  })

  for (const { code, data } of bundles) {
    it(`${code} has the same key set as en`, () => {
      const keys = Object.keys(data).sort()
      expect(keys).toEqual(englishKeys)
    })

    it(`${code} has no empty values`, () => {
      for (const [key, value] of Object.entries(data)) {
        expect(value, `key "${key}" in ${code}.json is empty`).toBeTruthy()
        expect(value.trim(), `key "${key}" in ${code}.json is whitespace-only`).not.toBe('')
      }
    })
  }
})
