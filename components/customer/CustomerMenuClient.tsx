'use client'

import { useState } from 'react'
import { CategoryTabs } from '@/components/customer/CategoryTabs'
import { MenuItemRow } from '@/components/customer/MenuItemRow'
import { ItemConfigSheet } from '@/components/customer/ItemConfigSheet'
import { CartBar } from '@/components/customer/CartBar'
import { UNCATEGORIZED_KEY } from '@/utils/customerMenu'
import type { Category, MenuItem, EnrichedMenuItem } from '@/types/app'

interface Props {
  categories: Category[]
  items: EnrichedMenuItem[]
  hasUncategorized: boolean
  restaurantName: string
}

export function CustomerMenuClient({ categories, items, hasUncategorized, restaurantName }: Props) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  const itemsByCategory = categories.reduce<Record<string, EnrichedMenuItem[]>>((acc, cat) => {
    acc[cat.id] = items.filter((i) => i.category_id === cat.id)
    return acc
  }, {})

  const uncategorized = items.filter((i) => i.category_id === null)

  return (
    <div>
      {categories.length > 0 || hasUncategorized ? (
        <CategoryTabs categories={categories} hasUncategorized={hasUncategorized} />
      ) : null}

      <header className="px-4 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary">{restaurantName}</h1>
      </header>

      <div>
        {categories.map((cat) => {
          const catItems = itemsByCategory[cat.id] ?? []
          return (
            <section key={cat.id} id={cat.id} className="scroll-mt-14 px-4 py-4">
              <h2 className="mb-3 text-base font-semibold text-text-primary">{cat.name}</h2>
              <div className="flex flex-col">
                {catItems.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    isAvailable={item.isAvailable}
                    onTap={item.isAvailable ? () => setSelectedItem(item) : undefined}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {hasUncategorized && (
          <section id={UNCATEGORIZED_KEY} className="scroll-mt-14 px-4 py-4">
            <h2 className="mb-3 text-base font-semibold text-text-primary">Uncategorized</h2>
            <div className="flex flex-col">
              {uncategorized.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  isAvailable={item.isAvailable}
                  onTap={item.isAvailable ? () => setSelectedItem(item) : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <ItemConfigSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      <CartBar />
    </div>
  )
}
