'use client'

import { useEffect } from 'react'

export function HtmlLangPatcher({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return null
}
