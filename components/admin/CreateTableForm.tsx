'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTable } from '@/actions/tableActions'

export function CreateTableForm() {
  const [number, setNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseInt(number, 10)
    if (isNaN(num)) {
      setError('Table number must be a whole number')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createTable(num)
      if (result.success) {
        setNumber('')
        router.refresh()
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to create table — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="table-number" className="mb-1 block text-sm font-medium text-text-primary">
          Table number
        </label>
        <input
          id="table-number"
          type="number"
          min={1}
          max={999}
          step={1}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="e.g. 5"
          className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !number}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Adding…' : 'Add table'}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-500">
          {error}
        </p>
      )}
    </form>
  )
}
