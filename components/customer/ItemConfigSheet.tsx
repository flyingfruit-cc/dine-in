'use client'

import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '@/utils/formatPrice'
import { useCartStore } from '@/stores/cartStore'
import type { MenuItem, CartItem, SelectedVariant } from '@/types/app'

interface Props {
  item: MenuItem | null
  onClose: () => void
}

function getEffectivePrice(item: MenuItem, selectedOptions: Record<string, string>): number {
  if (!item.variants.length) return item.price_cents
  for (const group of item.variants) {
    const selectedOptionId = selectedOptions[group.id]
    if (selectedOptionId) {
      const option = group.options.find((o) => o.id === selectedOptionId)
      if (option) return option.price_cents
    }
  }
  return item.price_cents
}

function buildInitialSelection(item: MenuItem): Record<string, string> {
  const selection: Record<string, string> = {}
  for (const group of item.variants) {
    if (group.options.length > 0) {
      selection[group.id] = group.options[0].id
    }
  }
  return selection
}

export function ItemConfigSheet({ item, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (item) {
      previousFocusRef.current = document.activeElement as HTMLElement
      setSelectedOptions(buildInitialSelection(item))
      dialog.showModal()
      requestAnimationFrame(() => headingRef.current?.focus())
    } else {
      dialog.close()
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [item])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  const handleAddToOrder = () => {
    if (!item) return

    const selectedVariantsList: SelectedVariant[] = item.variants
      .map((group) => {
        const optionId = selectedOptions[group.id]
        const option = group.options.find((o) => o.id === optionId)
        if (!option) return null
        return {
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          price_cents: option.price_cents,
        }
      })
      .filter((v): v is SelectedVariant => v !== null)

    const cartItem: CartItem = {
      cartItemId: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      price_cents: getEffectivePrice(item, selectedOptions),
      selectedVariants: selectedVariantsList,
    }

    useCartStore.getState().addItem(cartItem)
    onClose()
  }

  const displayedPrice = item ? getEffectivePrice(item, selectedOptions) : 0

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      onClick={handleBackdropClick}
      aria-modal="true"
      aria-labelledby="sheet-title"
      className="fixed bottom-0 left-0 right-0 m-0 w-full max-w-full rounded-t-2xl border-0 bg-surface p-0 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop:bg-black/50"
      style={{ top: 'auto' }}
    >
      <div className="flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Photo */}
        <div className="aspect-video w-full overflow-hidden bg-surface-overlay">
          {item?.image_url ? (
            <img
              src={item.image_url}
              alt={item?.name ?? ''}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 px-4 pt-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {/* Name + price */}
          <div className="flex items-start justify-between gap-2">
            <h2
              ref={headingRef}
              id="sheet-title"
              tabIndex={-1}
              className="text-[22px] font-semibold leading-7 text-text-primary outline-none"
            >
              {item?.name}
            </h2>
            <span className="shrink-0 font-mono text-base font-semibold text-text-primary">
              {formatPrice(displayedPrice)}
            </span>
          </div>

          {/* Description */}
          {item?.description && (
            <p className="text-sm text-text-secondary">{item.description}</p>
          )}

          {/* Variant selectors */}
          {item && item.variants.length > 0 && (
            <div className="flex flex-col gap-4">
              {item.variants.map((group) => (
                <div key={group.id} className="flex flex-col gap-2">
                  <span className="text-base font-medium text-text-primary">{group.name}</span>
                  <ul className="flex flex-wrap gap-2" role="list">
                    {group.options.slice(0, 6).map((option) => {
                      const isSelected = selectedOptions[group.id] === option.id
                      return (
                        <li key={option.id}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() =>
                              setSelectedOptions((prev) => ({ ...prev, [group.id]: option.id }))
                            }
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'border-border bg-surface text-text-primary'
                            }`}
                          >
                            {option.name}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Add to Order CTA */}
          <button
            type="button"
            onClick={handleAddToOrder}
            aria-label="Add to Order"
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-white"
          >
            Add to Order
          </button>
        </div>
      </div>
    </dialog>
  )
}
