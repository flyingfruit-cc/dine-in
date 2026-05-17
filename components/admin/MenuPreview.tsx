'use client'

import { useState, useRef, useEffect } from 'react'
import { isItemAvailable } from '@/utils/isAvailable'
import { formatPrice } from '@/utils/formatPrice'
import type { Category, MenuItem } from '@/types/app'

interface Props {
  categories: Category[]
  items: MenuItem[]
}

const UNCATEGORIZED_KEY = '__uncategorized__'

function ItemPhoto({ image_url, name }: { image_url: string | null; name: string }) {
  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-overlay">
      {image_url && (
        <img
          src={image_url}
          alt={name}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
    </div>
  )
}

function ItemRow({ item, now }: { item: MenuItem; now: Date }) {
  const available = isItemAvailable(item.availability_schedule, now)
  const variantNames = item.variants?.map((v) => v.name).filter(Boolean).join(', ')

  return (
    <li className={`flex gap-3 ${!available ? 'opacity-60' : ''}`}>
      <ItemPhoto image_url={item.image_url} name={item.name} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{item.name}</span>
        {item.description && (
          <span className="text-xs text-text-secondary">{item.description}</span>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {formatPrice(item.price_cents)}
          </span>
          {variantNames && (
            <span className="text-xs text-text-tertiary">{variantNames}</span>
          )}
        </div>
        {!available && (
          <span className="text-xs text-text-tertiary">Not available right now</span>
        )}
      </div>
    </li>
  )
}

export function MenuPreview({ categories, items }: Props) {
  const [activeTab, setActiveTab] = useState<string | null>(categories[0]?.id ?? null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat.id] = items.filter((i) => i.category_id === cat.id)
    return acc
  }, {})
  const uncategorized = items.filter((i) => i.category_id === null)
  const showTabBar = categories.length > 0 || uncategorized.length > 0

  // Stable ref so the effect dependency array stays empty while still
  // seeing the correct section order computed at mount time.
  const sectionOrderRef = useRef([
    ...categories.map((c) => c.id),
    ...(uncategorized.length > 0 ? [UNCATEGORIZED_KEY] : []),
  ])

  useEffect(() => {
    const order = sectionOrderRef.current
    const intersecting = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            intersecting.add(entry.target.id)
          } else {
            intersecting.delete(entry.target.id)
          }
        })
        const first = order.find((id) => intersecting.has(id))
        if (first) setActiveTab(first)
      },
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 }
    )

    order.forEach((id) => {
      const el = sectionRefs.current[id]
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveTab(id)
  }

  const now = new Date()

  return (
    <div>
      {showTabBar && (
        <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2">
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
          {uncategorized.length > 0 && (
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
      )}

      <div>
        {categories.map((cat) => {
          const catItems = itemsByCategory[cat.id] ?? []
          return (
            <section
              key={cat.id}
              id={cat.id}
              ref={(el) => { sectionRefs.current[cat.id] = el }}
              className="scroll-mt-14 px-4 py-4"
            >
              <h2 className="mb-3 text-base font-semibold text-text-primary">{cat.name}</h2>
              {catItems.length === 0 ? (
                <p className="text-sm text-text-secondary">No items yet</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {catItems.map((item) => (
                    <ItemRow key={item.id} item={item} now={now} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        {uncategorized.length > 0 && (
          <section
            id={UNCATEGORIZED_KEY}
            ref={(el) => { sectionRefs.current[UNCATEGORIZED_KEY] = el }}
            className="scroll-mt-14 px-4 py-4"
          >
            <h2 className="mb-3 text-base font-semibold text-text-primary">Uncategorized</h2>
            <ul className="flex flex-col gap-3">
              {uncategorized.map((item) => (
                <ItemRow key={item.id} item={item} now={now} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
