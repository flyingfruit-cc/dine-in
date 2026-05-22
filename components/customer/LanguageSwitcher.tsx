'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Globe, Check } from 'lucide-react'
import {
  LANGUAGE_LABEL,
  isAllowedLanguage,
  type AllowedLanguage,
} from '@/utils/languages'
import type { ChromeStrings } from '@/types/app'

interface Props {
  lang: AllowedLanguage
  supportedLanguages: string[]
  defaultLanguage: string
  chrome: ChromeStrings
}

export function LanguageSwitcher({
  lang,
  supportedLanguages,
  defaultLanguage,
  chrome,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const valid = supportedLanguages.filter(isAllowedLanguage)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (valid.length <= 1) return null

  const handleSelect = (code: AllowedLanguage) => {
    setOpen(false)
    const next = new URLSearchParams(searchParams.toString())
    if (code === defaultLanguage) {
      next.delete('lang')
    } else {
      next.set('lang', code)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const switcherLabel = chrome['menu.languageSwitcher'] ?? 'Change language'

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={switcherLabel}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
      >
        <Globe className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-label={switcherLabel}
          className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border bg-surface shadow-lg"
        >
          {valid.map((code) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={code === lang}
                onClick={() => handleSelect(code as AllowedLanguage)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay"
              >
                <span>{LANGUAGE_LABEL[code as AllowedLanguage]}</span>
                {code === lang && (
                  <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
