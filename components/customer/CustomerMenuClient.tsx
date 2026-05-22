'use client'

import { useState } from 'react'
import { CategoryTabs } from '@/components/customer/CategoryTabs'
import { MenuItemRow } from '@/components/customer/MenuItemRow'
import { ItemConfigSheet } from '@/components/customer/ItemConfigSheet'
import { CartBar } from '@/components/customer/CartBar'
import { LanguageSwitcher } from '@/components/customer/LanguageSwitcher'
import { HtmlLangPatcher } from '@/components/customer/HtmlLangPatcher'
import { UNCATEGORIZED_KEY } from '@/utils/customerMenu'
import type { AllowedLanguage } from '@/utils/languages'
import type { Category, ChromeStrings, MenuItem, EnrichedMenuItem } from '@/types/app'

interface Props {
  categories: Category[]
  items: EnrichedMenuItem[]
  hasUncategorized: boolean
  restaurantName: string
  lang: AllowedLanguage
  chrome: ChromeStrings
  supportedLanguages: string[]
  defaultLanguage: string
}

export function CustomerMenuClient({
  categories,
  items,
  hasUncategorized,
  restaurantName,
  lang,
  chrome,
  supportedLanguages,
  defaultLanguage,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  const itemsByCategory = categories.reduce<Record<string, EnrichedMenuItem[]>>((acc, cat) => {
    acc[cat.id] = items.filter((i) => i.category_id === cat.id)
    return acc
  }, {})

  const uncategorized = items.filter((i) => i.category_id === null)

  return (
    <div>
      <HtmlLangPatcher lang={lang} />
      {categories.length > 0 || hasUncategorized ? (
        <CategoryTabs categories={categories} hasUncategorized={hasUncategorized} chrome={chrome} />
      ) : null}

      <header className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary">{restaurantName}</h1>
        <LanguageSwitcher
          lang={lang}
          supportedLanguages={supportedLanguages}
          defaultLanguage={defaultLanguage}
          chrome={chrome}
        />
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
                    lang={lang}
                    chrome={chrome}
                    onTap={item.isAvailable ? () => setSelectedItem(item) : undefined}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {hasUncategorized && (
          <section id={UNCATEGORIZED_KEY} className="scroll-mt-14 px-4 py-4">
            <h2 className="mb-3 text-base font-semibold text-text-primary">{chrome['menu.uncategorized']}</h2>
            <div className="flex flex-col">
              {uncategorized.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  isAvailable={item.isAvailable}
                  lang={lang}
                  chrome={chrome}
                  onTap={item.isAvailable ? () => setSelectedItem(item) : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <ItemConfigSheet item={selectedItem} lang={lang} chrome={chrome} onClose={() => setSelectedItem(null)} />
      <CartBar lang={lang} chrome={chrome} defaultLanguage={defaultLanguage} />
    </div>
  )
}
