import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') },
}))

vi.mock('@/actions/restaurantActions', () => ({
  recordQrPrint: vi.fn().mockResolvedValue({ success: true, data: undefined }),
}))

import { QrCodeDisplay } from '@/components/admin/QrCodeDisplay'
import { recordQrPrint } from '@/actions/restaurantActions'
import QRCode from 'qrcode'

const mockRecordQrPrint = vi.mocked(recordQrPrint)
const mockToDataURL = vi.mocked(QRCode.toDataURL)

describe('QrCodeDisplay', () => {
  beforeEach(() => {
    mockRecordQrPrint.mockReset()
    mockToDataURL.mockReset()
    mockToDataURL.mockResolvedValue('data:image/png;base64,mock')
  })
  afterEach(() => cleanup())

  it('shows loading skeleton before QR code is generated', () => {
    mockToDataURL.mockReturnValue(new Promise(() => {})) // never resolves
    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    expect(screen.getByLabelText('Loading QR code')).toBeDefined()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders img with correct alt text after QR code generates', async () => {
    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    await waitFor(() =>
      expect(screen.getByAltText('QR code for table 1')).toBeDefined()
    )
    expect(screen.queryByLabelText('Loading QR code')).toBeNull()
  })

  it('buttons are disabled while QR code is loading', () => {
    mockToDataURL.mockReturnValue(new Promise(() => {}))
    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    const downloadBtn = screen.getByRole('button', { name: 'Download' })
    const printBtn = screen.getByRole('button', { name: 'Print' })
    expect((downloadBtn as HTMLButtonElement).disabled).toBe(true)
    expect((printBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('buttons are enabled after QR code loads', async () => {
    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    await waitFor(() => screen.getByAltText('QR code for table 1'))
    const downloadBtn = screen.getByRole('button', { name: 'Download' })
    const printBtn = screen.getByRole('button', { name: 'Print' })
    expect((downloadBtn as HTMLButtonElement).disabled).toBe(false)
    expect((printBtn as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls recordQrPrint when Download is clicked', async () => {
    mockRecordQrPrint.mockResolvedValue({ success: true, data: undefined })
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = originalCreate('a') as HTMLAnchorElement
        vi.spyOn(a, 'click').mockImplementation(() => {})
        return a
      }
      return originalCreate(tag)
    })

    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    await waitFor(() => screen.getByAltText('QR code for table 1'))

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    await waitFor(() => expect(mockRecordQrPrint).toHaveBeenCalledTimes(1))

    vi.restoreAllMocks()
  })

  it('calls recordQrPrint when Print is clicked', async () => {
    mockRecordQrPrint.mockResolvedValue({ success: true, data: undefined })
    vi.stubGlobal('open', vi.fn().mockReturnValue({
      document: { write: vi.fn(), close: vi.fn() },
    }))

    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    await waitFor(() => screen.getByAltText('QR code for table 1'))

    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    await waitFor(() => expect(mockRecordQrPrint).toHaveBeenCalledTimes(1))

    vi.unstubAllGlobals()
  })

  it('shows error message when QR code generation fails', async () => {
    mockToDataURL.mockRejectedValue(new Error('generation failed'))
    render(<QrCodeDisplay url="https://example.com/1" tableNumber={1} />)
    await waitFor(() =>
      expect(screen.getByText('Failed to generate QR code')).toBeDefined()
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByLabelText('Loading QR code')).toBeNull()
  })
})
