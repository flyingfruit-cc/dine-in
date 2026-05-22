import 'server-only'
import enBundle from '@/i18n/en.json'
import esBundle from '@/i18n/es.json'
import frBundle from '@/i18n/fr.json'
import jaBundle from '@/i18n/ja.json'
import zhBundle from '@/i18n/zh.json'
import type { ChromeStrings } from '@/types/app'
import type { AllowedLanguage } from '@/utils/languages'

const BUNDLES: Record<AllowedLanguage, ChromeStrings> = {
  en: enBundle as ChromeStrings,
  es: esBundle as ChromeStrings,
  fr: frBundle as ChromeStrings,
  ja: jaBundle as ChromeStrings,
  zh: zhBundle as ChromeStrings,
}

export function loadI18nBundle(lang: AllowedLanguage): ChromeStrings {
  if (lang === 'en') return BUNDLES.en
  return { ...BUNDLES.en, ...BUNDLES[lang] }
}
