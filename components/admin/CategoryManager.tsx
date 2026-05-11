'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategory, renameCategory, deleteCategory } from '@/actions/menuActions'
import type { Category } from '@/types/app'

interface Props {
  initialCategories: Category[]
}

export function CategoryManager({ initialCategories }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setIsCreating(true)
    setCreateError(null)
    const result = await createCategory(newName)
    setIsCreating(false)
    if (!result.success) {
      setCreateError(result.error)
      return
    }
    setCategories((prev) => [...prev, result.data.category])
    setNewName('')
    router.refresh()
  }

  const startRename = (cat: Category) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setRenameError(null)
  }

  const handleRenameBlur = async (cat: Category) => {
    const trimmed = editingName.trim()
    if (!trimmed || trimmed === cat.name) {
      setEditingId(null)
      return
    }
    try {
      const result = await renameCategory(cat.id, trimmed)
      if (result.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? result.data.category : c))
        )
        setEditingId(null)
      } else {
        setRenameError(result.error)
      }
    } catch {
      setRenameError('Unable to save — tap to try again')
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, cat: Category) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') {
      setEditingId(null)
      setEditingName(cat.name)
      setRenameError(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteCategory(deleteTarget.id)
      if (result.success) {
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        setDeleteTarget(null)
        router.refresh()
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
    <div className="flex flex-col gap-6">
      {/* Create form */}
      <form
        aria-label="Add category"
        onSubmit={handleCreate}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex h-10 flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={isCreating || !newName.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isCreating ? 'Adding…' : 'Add'}
        </button>
      </form>
      {createError && (
        <p role="alert" className="text-sm text-red-500">
          {createError}
        </p>
      )}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-text-secondary">
            Add your first category →
          </p>
        </div>
      )}

      {/* Category list */}
      {categories.length > 0 && (
        <ul className="flex flex-col gap-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-col rounded-lg border border-border bg-surface-raised px-4 py-3"
            >
              <div className="flex items-center justify-between">
                {editingId === cat.id ? (
                  <input
                    type="text"
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRenameBlur(cat)}
                    onKeyDown={(e) => handleRenameKeyDown(e, cat)}
                    className="flex-1 bg-transparent text-sm font-medium text-text-primary focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startRename(cat)}
                    className="flex-1 text-left text-sm font-medium text-text-primary hover:text-accent"
                  >
                    {cat.name}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Delete ${cat.name}`}
                  onClick={() => setDeleteTarget(cat)}
                  className="ml-4 text-sm text-text-tertiary hover:text-red-500"
                >
                  Delete
                </button>
              </div>
              {editingId === cat.id && renameError && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {renameError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Destructive confirmation dialog */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
            <h2 id="dialog-title" className="mb-2 text-base font-semibold text-text-primary">
              Delete &ldquo;{deleteTarget.name}&rdquo;?
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              This will permanently delete the category and all its menu items.
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
                {isDeleting ? 'Deleting…' : 'Delete category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
