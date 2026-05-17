'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { publishMenu, takeMenuOffline } from '@/actions/restaurantActions'

interface Props {
  isPublished: boolean
}

export function MenuPublishToggle({ isPublished }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false)
  const router = useRouter()

  const handlePublish = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await publishMenu()
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to publish — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTakeOffline = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await takeMenuOffline()
      if (result.success) {
        setShowOfflineConfirm(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to take offline — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isPublished) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Publishing…' : 'Publish menu'}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <p className="mb-2 text-sm font-medium text-text-primary">
          Your menu is live. Print your QR codes and place them on tables.
        </p>
        <Link href="/admin/tables" className="text-sm text-accent hover:underline">
          Go to Tables →
        </Link>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowOfflineConfirm(true)}
            className="text-sm text-red-500 hover:underline"
          >
            Take offline
          </button>
        </div>
      </div>

      {showOfflineConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
            <h2 id="offline-dialog-title" className="mb-2 text-base font-semibold text-text-primary">
              Take menu offline?
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              Customers scanning your QR codes will see &ldquo;Menu unavailable&rdquo; until you publish again.
            </p>
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowOfflineConfirm(false); setError(null) }}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTakeOffline}
                disabled={isSubmitting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? 'Taking offline…' : 'Take offline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
