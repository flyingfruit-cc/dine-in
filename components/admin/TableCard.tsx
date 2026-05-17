'use client'

import type { Table } from '@/types/app'
import { generateQrUrl } from '@/utils/generateQrUrl'
import { QrCodeDisplay } from './QrCodeDisplay'

interface Props {
  table: Table
  restaurantSlug: string
}

export function TableCard({ table, restaurantSlug }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="mb-3 text-sm font-semibold text-text-primary">Table {table.number}</p>
      <QrCodeDisplay
        url={generateQrUrl(restaurantSlug, table.number)}
        tableNumber={table.number}
      />
    </div>
  )
}
