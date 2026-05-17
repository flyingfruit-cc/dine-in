'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { recordQrPrint } from '@/actions/restaurantActions'

interface Props {
  url: string
  tableNumber: number
}

export function QrCodeDisplay({ url, tableNumber }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 256, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrError('Failed to generate QR code'))
  }, [url])

  const handleDownload = async () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `table-${tableNumber}-qr.png`
    a.click()
    await recordQrPrint()
  }

  const handlePrint = async () => {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(
      `<img src="${qrDataUrl}" onload="window.print();window.close()" style="max-width:100%" />`
    )
    win.document.close()
    await recordQrPrint()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {qrError ? (
        <p className="text-xs text-red-500">{qrError}</p>
      ) : qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR code for table ${tableNumber}`}
          width={128}
          height={128}
          className="rounded"
        />
      ) : (
        <div className="h-32 w-32 animate-pulse rounded bg-surface" aria-label="Loading QR code" />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface disabled:opacity-50"
        >
          Download
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface disabled:opacity-50"
        >
          Print
        </button>
      </div>
    </div>
  )
}
