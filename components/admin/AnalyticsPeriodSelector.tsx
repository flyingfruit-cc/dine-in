'use client'

import { useRouter } from 'next/navigation'
import type { AnalyticsPeriod } from '@/types/app'

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

interface Props {
  currentPeriod: AnalyticsPeriod
}

export function AnalyticsPeriodSelector({ currentPeriod }: Props) {
  const router = useRouter()

  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {PERIODS.map(({ value, label }) => {
        const active = currentPeriod === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => router.push(`/admin/analytics?period=${value}`)}
            className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-accent bg-accent-muted text-accent'
                : 'border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
