'use client'

import type { VariantGroup, VariantOption } from '@/types/app'

interface Props {
  variants: VariantGroup[]
  onChange: (variants: VariantGroup[]) => void
}

const MAX_OPTIONS = 6

export function VariantEditor({ variants, onChange }: Props) {
  const addGroup = () => {
    onChange([
      ...variants,
      { id: crypto.randomUUID(), name: '', options: [] },
    ])
  }

  const removeGroup = (groupId: string) => {
    onChange(variants.filter((g) => g.id !== groupId))
  }

  const updateGroupName = (groupId: string, name: string) => {
    onChange(variants.map((g) => g.id === groupId ? { ...g, name } : g))
  }

  const addOption = (groupId: string) => {
    onChange(
      variants.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                { id: crypto.randomUUID(), name: '', price_cents: 0 },
              ],
            }
          : g
      )
    )
  }

  const removeOption = (groupId: string, optionId: string) => {
    onChange(
      variants.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.filter((o) => o.id !== optionId) }
          : g
      )
    )
  }

  const updateOptionName = (groupId: string, optionId: string, name: string) => {
    onChange(
      variants.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) =>
                o.id === optionId ? { ...o, name } : o
              ),
            }
          : g
      )
    )
  }

  const updateOptionPrice = (groupId: string, optionId: string, value: string) => {
    const price_cents = Math.round((parseFloat(value) || 0) * 100)
    onChange(
      variants.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) =>
                o.id === optionId ? { ...o, price_cents } : o
              ),
            }
          : g
      )
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.map((group) => (
        <div
          key={group.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4"
        >
          {/* Group header */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Group name (e.g. Size)"
              value={group.name}
              onChange={(e) => updateGroupName(group.id, e.target.value)}
              className="flex h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm font-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              aria-label="Remove group"
              onClick={() => removeGroup(group.id)}
              className="shrink-0 text-sm text-text-tertiary hover:text-red-500"
            >
              Remove group
            </button>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2 pl-2">
            {group.options.map((option) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Option name (e.g. Small)"
                  value={option.name}
                  onChange={(e) => updateOptionName(group.id, option.id, e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-secondary">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={(option.price_cents / 100).toFixed(2)}
                    onChange={(e) => updateOptionPrice(group.id, option.id, e.target.value)}
                    className="h-9 w-24 rounded-md border border-border bg-transparent px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() => removeOption(group.id, option.id)}
                  className="shrink-0 text-sm text-text-tertiary hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              disabled={group.options.length >= MAX_OPTIONS}
              onClick={() => addOption(group.id)}
              className="self-start text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add option
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="self-start rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
      >
        Add variant group
      </button>
    </div>
  )
}
