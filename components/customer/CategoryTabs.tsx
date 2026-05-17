'use client'

import { useState, useRef, useEffect } from 'react'
import type { Category } from '@/types/app'
import { UNCATEGORIZED_KEY } from '@/utils/customerMenu'

interface Props {
  categories: Category[]
  hasUncategorized: boolean
}

export function CategoryTabs({ categories, hasUncategorized }: Props) {
  const allIds = [
    ...categories.map((c) => c.id),
    ...(hasUncategorized ? [UNCATEGORIZED_KEY] : []),
  ]

  const [activeTab, setActiveTab] = useState<string | null>(allIds[0] ?? null)

  const sectionOrderRef = useRef(allIds)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const suppressRef = useRef(false)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const order = sectionOrderRef.current

    const updateActive = () => {
      if (suppressRef.current) return
      const threshold = tabBarRef.current?.getBoundingClientRect().bottom ?? 56
      let active: string | null = order[0] ?? null
      for (const id of order) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= threshold) {
          active = id
        } else {
          break
        }
      }
      if (active) setActiveTab(active)
    }

    let rafId: number
    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateActive)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    updateActive()

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  const scrollToSection = (id: string) => {
    suppressRef.current = true
    clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      suppressRef.current = false
    }, 800)

    const el = document.getElementById(id)
    if (el) {
      const barHeight = tabBarRef.current?.getBoundingClientRect().height ?? 56
      const top = el.getBoundingClientRect().top + window.scrollY - barHeight
      window.scrollTo({ top, behavior: 'smooth' })
    }
    setActiveTab(id)
  }

  return (
    <>
      <div ref={tabBarRef} className="fixed top-0 inset-x-0 z-10 border-b border-border bg-background">
        <div className="flex gap-1 overflow-x-auto px-4 py-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToSection(cat.id)}
              aria-current={activeTab === cat.id ? 'true' : undefined}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium transition-colors
                ${activeTab === cat.id
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              {cat.name}
            </button>
          ))}
          {hasUncategorized && (
            <button
              type="button"
              onClick={() => scrollToSection(UNCATEGORIZED_KEY)}
              aria-current={activeTab === UNCATEGORIZED_KEY ? 'true' : undefined}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium transition-colors
                ${activeTab === UNCATEGORIZED_KEY
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Uncategorized
            </button>
          )}
        </div>
      </div>
      {/* Spacer matches the fixed bar height so content starts below it */}
      <div className="h-12" aria-hidden />
    </>
  )
}
