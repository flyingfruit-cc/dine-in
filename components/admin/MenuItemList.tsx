'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { deleteMenuItem, reorderMenuItems } from '@/actions/menuActions'
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

function SortableItemRow({ item, onDeleteClick }: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.name}`}
        className="cursor-grab text-text-tertiary active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex flex-1 items-center justify-between">
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
      </div>
    </li>
  )
}

interface CategorySectionProps {
  categoryId: string | null
  categoryName: string
  sectionItems: MenuItem[]
  onDeleteClick: (item: MenuItem) => void
  onDragEnd: (event: DragEndEvent, categoryId: string | null) => void
  reorderError: { categoryId: string | null; message: string } | null
}

function CategorySection({
  categoryId,
  categoryName,
  sectionItems,
  onDeleteClick,
  onDragEnd,
  reorderError,
}: CategorySectionProps) {
  const sectionError = reorderError?.categoryId === categoryId ? reorderError.message : null
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
        <DndContext
          id={`dnd-${categoryId ?? 'uncategorized'}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => onDragEnd(event, categoryId)}
        >
          <SortableContext items={sectionItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {sectionItems.map((item) => (
                <SortableItemRow key={item.id} item={item} onDeleteClick={onDeleteClick} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {sectionError && (
        <p role="alert" className="text-sm text-red-500">
          {sectionError}
        </p>
      )}
      <Link
        href={`/admin/menu/new${categoryId ? `?category=${categoryId}` : ''}`}
        className="self-start text-sm text-text-secondary hover:text-accent"
      >
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
  const [reorderError, setReorderError] = useState<{ categoryId: string | null; message: string } | null>(null)

  const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat.id] = localItems
      .filter((i) => i.category_id === cat.id)
      .sort((a, b) => a.display_order - b.display_order)
    return acc
  }, {})
  const uncategorized = localItems
    .filter((i) => i.category_id === null)
    .sort((a, b) => a.display_order - b.display_order)

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

  const handleDragEnd = async (event: DragEndEvent, categoryId: string | null) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const categoryItems = localItems
      .filter((i) => i.category_id === categoryId)
      .sort((a, b) => a.display_order - b.display_order)

    const oldIndex = categoryItems.findIndex((i) => i.id === active.id)
    const newIndex = categoryItems.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(categoryItems, oldIndex, newIndex)
    const updates = reordered.map((item, idx) => ({ id: item.id, display_order: idx }))

    const previousItems = localItems
    setLocalItems((prev) => {
      const others = prev.filter((i) => i.category_id !== categoryId)
      return [...others, ...reordered.map((item, idx) => ({ ...item, display_order: idx }))]
    })
    setReorderError(null)

    const result = await reorderMenuItems(updates)
    if (!result.success) {
      setLocalItems(previousItems)
      setReorderError({ categoryId, message: result.error })
    }
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm text-text-secondary">Add a category above to start adding items</p>
      </div>
    )
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
          onDragEnd={handleDragEnd}
          reorderError={reorderError}
        />
      ))}
      {uncategorized.length > 0 && (
        <CategorySection
          categoryId={null}
          categoryName="Uncategorized"
          sectionItems={uncategorized}
          onDeleteClick={handleDeleteClick}
          onDragEnd={handleDragEnd}
          reorderError={reorderError}
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
