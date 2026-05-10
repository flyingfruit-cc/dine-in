'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteMenuItem } from '@/actions/menuActions'
import { formatPrice } from '@/utils/formatPrice'
import type { Category, MenuItem } from '@/types/app'

interface Props {
  categories: Category[]
  items: MenuItem[]
}

interface ItemRowProps {
  item: MenuItem
  onDeleteClick: (item: MenuItem) => void
}

function ItemRow({ item, onDeleteClick }: ItemRowProps) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-primary">{item.name}</span>
        <span className="text-xs text-text-secondary">{formatPrice(item.price_cents)}</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/menu/${item.id}`}
          className="text-sm text-text-secondary hover:text-accent"
        >
          Edit
        </Link>
        <button
          type="button"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDeleteClick(item)}
          className="text-sm text-text-tertiary hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </li>
  )
}

interface CategorySectionProps {
  categoryId: string | null
  categoryName: string
  sectionItems: MenuItem[]
  onDeleteClick: (item: MenuItem) => void
}

function CategorySection({ categoryId, categoryName, sectionItems, onDeleteClick }: CategorySectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-secondary">{categoryName}</h3>
      {sectionItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-6 text-center">
          <Link href="/admin/menu/new" className="text-sm text-text-secondary hover:text-accent">
            Add your first item →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sectionItems.map((item) => (
            <ItemRow key={item.id} item={item} onDeleteClick={onDeleteClick} />
          ))}
        </ul>
      )}
      <Link href={`/admin/menu/new${categoryId ? `?category=${categoryId}` : ''}`} className="self-start text-sm text-text-secondary hover:text-accent">
        Add item →
      </Link>
    </div>
  )
}

export function MenuItemList({ categories, items }: Props) {
  const [localItems, setLocalItems] = useState<MenuItem[]>(items)
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat.id] = localItems.filter((i) => i.category_id === cat.id)
    return acc
  }, {})
  const uncategorized = localItems.filter((i) => i.category_id === null)

  const handleDeleteClick = (item: MenuItem) => {
    setDeleteTarget(item)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteMenuItem(deleteTarget.id)
      if (result.success) {
        setLocalItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        setDeleteError(result.error)
      }
    } catch {
      setDeleteError('Unable to delete — tap to try again')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {categories.map((cat) => (
        <CategorySection
          key={cat.id}
          categoryId={cat.id}
          categoryName={cat.name}
          sectionItems={itemsByCategory[cat.id] ?? []}
          onDeleteClick={handleDeleteClick}
        />
      ))}
      {uncategorized.length > 0 && (
        <CategorySection
          categoryId={null}
          categoryName="Uncategorized"
          sectionItems={uncategorized}
          onDeleteClick={handleDeleteClick}
        />
      )}

      {/* Destructive confirmation dialog */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
            <h2 id="delete-item-dialog-title" className="mb-2 text-base font-semibold text-text-primary">
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              This will permanently delete this menu item.
            </p>
            {deleteError && (
              <p role="alert" className="mb-4 text-sm text-red-500">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
