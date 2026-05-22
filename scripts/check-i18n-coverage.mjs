#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const i18nDir = path.join(process.cwd(), 'i18n')
const englishPath = path.join(i18nDir, 'en.json')
const englishKeys = new Set(Object.keys(JSON.parse(readFileSync(englishPath, 'utf8'))))

const bundles = readdirSync(i18nDir).filter((f) => f.endsWith('.json') && f !== 'en.json')

let failed = false
for (const file of bundles) {
  const data = JSON.parse(readFileSync(path.join(i18nDir, file), 'utf8'))
  const keys = new Set(Object.keys(data))
  const missing = [...englishKeys].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !englishKeys.has(k))
  if (missing.length || extra.length) {
    failed = true
    console.error(`[i18n] ${file}: missing ${missing.length}, extra ${extra.length}`)
    if (missing.length) console.error('  missing keys:', missing.join(', '))
    if (extra.length) console.error('  extra keys:', extra.join(', '))
  }
}
if (failed) {
  console.error('\nFAIL: i18n bundles have key mismatches.')
  process.exit(1)
}
console.log(`OK: all bundles align with en.json (${englishKeys.size} keys, ${bundles.length} bundles)`)
