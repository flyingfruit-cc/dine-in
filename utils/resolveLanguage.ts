import { isAllowedLanguage, type AllowedLanguage } from '@/utils/languages'

interface ResolveInput {
  urlLang: string | undefined
  supportedLanguages: string[]
  defaultLanguage: string
}

// Resolution priority: URL ?lang= → restaurants.default_language → 'en'.
// Accept-Language is intentionally NOT consulted: the owner-set default
// is the source of truth for QR scans. Customers manually switch via the
// LanguageSwitcher when they want a different language.
export function resolveLanguage({
  urlLang,
  supportedLanguages,
  defaultLanguage,
}: ResolveInput): AllowedLanguage {
  if (urlLang && isAllowedLanguage(urlLang) && supportedLanguages.includes(urlLang)) {
    return urlLang
  }
  if (isAllowedLanguage(defaultLanguage)) return defaultLanguage
  return 'en'
}
