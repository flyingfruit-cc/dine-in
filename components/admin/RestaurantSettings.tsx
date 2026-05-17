'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updateRestaurantName } from '@/actions/restaurantActions'

interface Props {
  name: string
  slug: string
}

export function RestaurantSettings({ name: initialName, slug }: Props) {
  const [name, setName] = useState(initialName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSuccess(false)
    setError(null)

    const result = await updateRestaurantName(name)

    setIsSubmitting(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Restaurant profile</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="restaurant-name" className="text-sm font-medium text-text-primary">
              Restaurant name
            </label>
            <input
              id="restaurant-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSuccess(false); setError(null) }}
              required
              className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-text-primary">Customer URL</span>
            <div className="flex h-10 items-center rounded-md border border-border bg-surface px-3 text-sm text-text-secondary">
              dine-in/{slug}
            </div>
            <p className="text-xs text-text-secondary">
              Your URL cannot be changed — it&apos;s embedded in your printed QR codes.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">{error}</p>
          )}
          {success && (
            <p role="status" className="text-sm text-green-600">Restaurant name updated.</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Account</h2>
        <Link
          href="/auth/update-password"
          className="text-sm text-accent hover:underline"
        >
          Change password →
        </Link>
      </section>
    </div>
  )
}
