'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Table } from '@/types/app'
import { generateQrUrl } from '@/utils/generateQrUrl'
import { QrCodeDisplay } from './QrCodeDisplay'
import { deleteTable } from '@/actions/tableActions'

interface Props {
  table: Table
  restaurantSlug: string
}

export function TableCard({ table, restaurantSlug }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteTable(table.id)
      if (result.success) {
        setShowConfirm(false)
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

  const dialogTitleId = `delete-table-${table.id}-title`

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">Table {table.number}</p>
        <button
          type="button"
          onClick={() => { setShowConfirm(true); setDeleteError(null) }}
          className="text-xs text-text-secondary hover:text-red-500"
        >
          Delete
        </button>
      </div>
      <QrCodeDisplay
        url={generateQrUrl(restaurantSlug, table.number)}
        tableNumber={table.number}
      />

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
            <h2
              id={dialogTitleId}
              className="mb-2 text-base font-semibold text-text-primary"
            >
              Delete Table {table.number}?
            </h2>
            <p className="mb-4 text-sm text-text-secondary">
              This QR code will stop working immediately.
            </p>
            {deleteError && (
              <p role="alert" className="mb-3 text-sm text-red-500">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setDeleteError(null) }}
                disabled={isDeleting}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
