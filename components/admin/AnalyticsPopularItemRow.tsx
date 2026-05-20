'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatPrice } from '@/utils/formatPrice'
import type { TopItem } from '@/types/app'

interface Props {
  rank: number
  item: TopItem
}

export function AnalyticsPopularItemRow({ rank, item }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const panelId = useId()

  // "standard" is the sentinel for items with no real variant — no breakdown to show
  const variantKeys = Object.keys(item.variants)
  const hasBreakdown =
    variantKeys.length > 1 || (variantKeys.length === 1 && variantKeys[0] !== 'standard')

  const variantEntries = Object.entries(item.variants).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  const variantBreakdownString = variantEntries.map(([label, n]) => `${label}: ${n}`).join(' / ')

  const rowContent = (
    <>
      <span className="w-6 text-right text-sm font-semibold text-text-secondary tabular-nums">
        {rank}
      </span>
      <span className="flex-1 truncate text-sm font-medium text-text-primary">{item.name}</span>
      <span className="shrink-0 text-sm text-text-secondary tabular-nums">{item.quantity}</span>
      <span className="shrink-0 text-sm text-text-secondary tabular-nums">
        {formatPrice(item.revenueCents)}
      </span>
      {hasBreakdown && (
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      )}
    </>
  )

  return (
    <div className="border-b border-border last:border-b-0">
      {hasBreakdown ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => setIsExpanded((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          {rowContent}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{rowContent}</div>
      )}

      {hasBreakdown && isExpanded && (
        <div id={panelId} className="px-4 pb-3 pl-12 text-xs text-text-secondary">
          {variantBreakdownString}
        </div>
      )}
    </div>
  )
}
