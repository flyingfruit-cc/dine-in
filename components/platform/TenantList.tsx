'use client'

import Link from 'next/link'
import { useState } from 'react'

export interface TenantRow {
  id: string
  name: string
  slug: string
  created_at: string
  is_published: boolean
}

interface Props {
  restaurants: TenantRow[]
}

export function TenantList({ restaurants }: Props) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const filtered = trimmed
    ? restaurants.filter((r) => r.name.toLowerCase().includes(trimmed.toLowerCase()))
    : restaurants

  return (
    <div>
      <input
        type="search"
        aria-label="Search restaurants by name"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {restaurants.length === 0 ? (
        <p className="text-sm text-text-secondary">No restaurants registered yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-secondary">No restaurants match &quot;{trimmed}&quot;</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((r) => (
            <li key={r.id} className="py-3 hover:bg-surface-raised transition-colors rounded-md focus-within:bg-surface-raised">
              <Link
                href={`/platform/tenants/${r.id}`}
                className="flex items-center justify-between gap-4 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div>
                  <p className="font-semibold text-text-primary">{r.name}</p>
                  <p className="text-sm text-text-secondary">{r.slug}</p>
                  <p className="text-xs text-text-secondary">
                    Joined {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    r.is_published
                      ? 'bg-accent text-white'
                      : 'bg-border text-text-secondary'
                  }`}
                >
                  {r.is_published ? 'Published' : 'Offline'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
