'use client'

import { formatPrice } from '@/utils/formatPrice'
import type { MenuItem } from '@/types/app'

interface Props {
  item: MenuItem
  isAvailable: boolean
  onTap?: () => void
}

export function MenuItemRow({ item, isAvailable, onTap }: Props) {
  const handleTap = () => {
    if (!isAvailable || !onTap) return
    onTap()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTap()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.name}, ${formatPrice(item.price_cents)}`}
      aria-disabled={!isAvailable ? 'true' : undefined}
      onClick={handleTap}
      onKeyDown={handleKeyDown}
      className={`flex gap-3 py-3 border-b border-border ${isAvailable ? 'cursor-pointer' : 'cursor-default'} ${!isAvailable ? 'opacity-60' : ''}`}
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-overlay">
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            width={80}
            height={80}
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      <div className="flex flex-col gap-0.5 flex-1 min-h-[44px]">
        <span className="line-clamp-2 text-sm font-medium text-text-primary">{item.name}</span>
        {item.description && (
          <span className="line-clamp-2 text-xs text-text-secondary">{item.description}</span>
        )}
        {!isAvailable && (
          <span className="text-xs text-text-tertiary">Not available right now</span>
        )}
      </div>
      <span className="shrink-0 self-start text-sm font-medium text-text-primary">
        {formatPrice(item.price_cents)}
      </span>
    </div>
  )
}
