export const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'ja', 'zh'] as const
export type AllowedLanguage = typeof ALLOWED_LANGUAGES[number]
export const LANGUAGE_LABEL: Record<AllowedLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  ja: 'Japanese',
  zh: 'Chinese',
}
export function isAllowedLanguage(value: unknown): value is AllowedLanguage {
  return typeof value === 'string' && (ALLOWED_LANGUAGES as readonly string[]).includes(value)
}
