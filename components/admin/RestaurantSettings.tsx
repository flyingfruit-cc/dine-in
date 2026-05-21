'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updateRestaurantName, updateRestaurantLanguages } from '@/actions/restaurantActions'
import { ALLOWED_LANGUAGES, LANGUAGE_LABEL, type AllowedLanguage } from '@/utils/languages'

interface Props {
  name: string
  slug: string
  supportedLanguages: string[]
  defaultLanguage: string
}

export function RestaurantSettings({ name: initialName, slug, supportedLanguages, defaultLanguage }: Props) {
  const [name, setName] = useState(initialName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedLanguages, setSelectedLanguages] = useState<AllowedLanguage[]>(() => {
    const langs = Array.from(new Set(
      supportedLanguages.filter((l): l is AllowedLanguage => ALLOWED_LANGUAGES.includes(l as AllowedLanguage))
    ))
    return langs.includes('en') ? langs : ['en', ...langs]
  })
  const [selectedDefault, setSelectedDefault] = useState<AllowedLanguage>(() => {
    const seeded = Array.from(new Set(
      supportedLanguages.filter((l): l is AllowedLanguage => ALLOWED_LANGUAGES.includes(l as AllowedLanguage))
    ))
    const langs = seeded.includes('en') ? seeded : (['en', ...seeded] as AllowedLanguage[])
    const candidate = ALLOWED_LANGUAGES.includes(defaultLanguage as AllowedLanguage)
      ? (defaultLanguage as AllowedLanguage)
      : 'en'
    return langs.includes(candidate) ? candidate : 'en'
  })
  const [isSubmittingLanguages, setIsSubmittingLanguages] = useState(false)
  const [languagesSuccess, setLanguagesSuccess] = useState(false)
  const [languagesError, setLanguagesError] = useState<string | null>(null)

  const clearLanguagesBanners = () => {
    setLanguagesSuccess(false)
    setLanguagesError(null)
  }

  const toggleLanguage = (code: AllowedLanguage) => {
    if (code === 'en') return
    clearLanguagesBanners()
    setSelectedLanguages((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((l) => l !== code)
        if (selectedDefault === code) setSelectedDefault('en')
        return next
      }
      if (prev.length >= ALLOWED_LANGUAGES.length) return prev
      return [...prev, code]
    })
  }

  const handleSaveLanguages = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingLanguages(true)
    setLanguagesSuccess(false)
    setLanguagesError(null)
    const result = await updateRestaurantLanguages(selectedLanguages, selectedDefault)
    setIsSubmittingLanguages(false)
    if (result.success) {
      setLanguagesSuccess(true)
    } else {
      setLanguagesError(result.error)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess(false)
    setError(null)

    const result = await updateRestaurantName(name)

    setIsSubmitting(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Restaurant profile</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="restaurant-name" className="text-sm font-medium text-text-primary">
              Restaurant name
            </label>
            <input
              id="restaurant-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSuccess(false); setError(null) }}
              required
              className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-text-primary">Customer URL</span>
            <div className="flex h-10 items-center rounded-md border border-border bg-surface px-3 text-sm text-text-secondary">
              dine-in/{slug}
            </div>
            <p className="text-xs text-text-secondary">
              Your URL cannot be changed — it&apos;s embedded in your printed QR codes.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">{error}</p>
          )}
          {success && (
            <p role="status" className="text-sm text-green-600">Restaurant name updated.</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Languages</h2>
        <form onSubmit={handleSaveLanguages} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text-primary mb-2">Enabled languages</legend>
            {ALLOWED_LANGUAGES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(code)}
                  disabled={code === 'en'}
                  onChange={() => toggleLanguage(code)}
                  aria-label={LANGUAGE_LABEL[code]}
                />
                {LANGUAGE_LABEL[code]}
                {code === 'en' && <span className="text-xs text-text-tertiary">(always required)</span>}
              </label>
            ))}
            <p className="text-xs text-text-tertiary">Up to 5 languages. English is always enabled.</p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text-primary mb-2">Default language</legend>
            {selectedLanguages.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="default-language"
                  value={code}
                  checked={selectedDefault === code}
                  onChange={() => { clearLanguagesBanners(); setSelectedDefault(code) }}
                />
                {LANGUAGE_LABEL[code]}
              </label>
            ))}
          </fieldset>

          {languagesError && <p role="alert" className="text-sm text-red-500">{languagesError}</p>}
          {languagesSuccess && <p role="status" className="text-sm text-green-600">Languages updated.</p>}
          <div>
            <button
              type="submit"
              disabled={isSubmittingLanguages}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmittingLanguages ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Account</h2>
        <Link
          href="/auth/update-password"
          className="text-sm text-accent hover:underline"
        >
          Change password →
        </Link>
      </section>
    </div>
  )
}
