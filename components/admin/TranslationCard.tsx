'use client'

import { useEffect, useRef, useState } from 'react'
import { updateMenuItemTranslation } from '@/actions/menuActions'
import { LANGUAGE_LABEL, type AllowedLanguage } from '@/utils/languages'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  itemId: string
  langCode: AllowedLanguage
  initialName: string
  initialDescription: string
}

export function TranslationCard({ itemId, langCode, initialName, initialDescription }: Props) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSeqRef = useRef(0)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmedName = name.trim()
    if (!trimmedName) {
      // Clear stale error when the user empties the name — keeps the card honest.
      setStatus((prev) => (prev === 'error' ? 'idle' : prev))
      return
    }
    timerRef.current = setTimeout(async () => {
      const mySeq = ++saveSeqRef.current
      setStatus('saving')
      const result = await updateMenuItemTranslation(itemId, langCode, {
        name: trimmedName,
        description: description.trim() || null,
      })
      if (saveSeqRef.current !== mySeq) return // a newer save has started; ignore stale response
      if (!result.success) {
        setStatus('error')
        return
      }
      setStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
    }, 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [name, description, itemId, langCode])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium text-text-primary">{LANGUAGE_LABEL[langCode]}</h3>
      <input
        type="text"
        placeholder={`Item name (${LANGUAGE_LABEL[langCode]})`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`${LANGUAGE_LABEL[langCode]} name`}
        className="h-10 rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <textarea
        placeholder={`Description (${LANGUAGE_LABEL[langCode]})`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        aria-label={`${LANGUAGE_LABEL[langCode]} description`}
        className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
      />
      <div className="min-h-[1.25rem] text-xs" role="status" aria-live="polite">
        {status === 'saving' && <span className="text-text-tertiary">Saving…</span>}
        {status === 'saved' && <span className="text-green-600">Saved ✓</span>}
        {status === 'error' && <span className="text-red-500">Saving failed — tap to retry</span>}
      </div>
    </div>
  )
}
