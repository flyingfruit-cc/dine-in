import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'
import { makeChrome } from './_fixtures/chromeFixture'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// --- Supabase browser client mock ---
let pollSingleMock: ReturnType<typeof vi.fn>

type PollResult = { data: { id: string; status: string } | null; error: { code: string; message: string } | null }

function resetPollMock(returnValue: PollResult = { data: { id: 'o-1', status: 'received' }, error: null }) {
  pollSingleMock = vi.fn().mockResolvedValue(returnValue)
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn((...args: unknown[]) => (pollSingleMock as (...a: unknown[]) => unknown)(...args)),
    }),
  })),
}))

const defaultItems = [
  { name: 'Burger', quantity: 2, variantNames: ['Large'] },
  { name: 'Fries', quantity: 1, variantNames: [] },
]

const defaultProps = {
  orderId: 'o-1',
  initialStatus: 'received' as const,
  restaurantName: 'Test Restaurant',
  tableNumber: 3,
  items: defaultItems,
  lang: 'en',
  chrome: makeChrome(),
}

beforeEach(() => {
  resetPollMock()
})

describe('OrderConfirmationScreen', () => {
  describe('static rendering', () => {
    it('renders headline for received status', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.getByText('Your order is with the kitchen')).toBeDefined()
    })

    it('renders headline for preparing status', () => {
      render(<OrderConfirmationScreen {...defaultProps} initialStatus="preparing" />)
      expect(screen.getByText('Your food is being prepared')).toBeDefined()
    })

    it('renders headline for ready status', () => {
      render(<OrderConfirmationScreen {...defaultProps} initialStatus="ready" />)
      expect(screen.getByText('Your order is ready')).toBeDefined()
    })

    it('renders headline for completed status', () => {
      render(<OrderConfirmationScreen {...defaultProps} initialStatus="completed" />)
      expect(screen.getByText('Order completed — enjoy your meal')).toBeDefined()
    })

    it('renders each item name with quantity prefix', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.getByText('2× Burger')).toBeDefined()
      expect(screen.getByText('1× Fries')).toBeDefined()
    })

    it('renders variant names below item name', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.getByText('Large')).toBeDefined()
    })

    it('renders restaurant name and table number', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.getByText('Test Restaurant · Table 3')).toBeDefined()
    })

    it('does NOT render any price', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.queryByText(/\$/)).toBeNull()
    })

    it('renders no interactive buttons or links (closed loop)', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.queryAllByRole('link')).toHaveLength(0)
    })

    it('headline has aria-live="assertive"', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      const headline = screen.getByText('Your order is with the kitchen')
      expect(headline.getAttribute('aria-live')).toBe('assertive')
    })

    it('headline has tabIndex={-1}', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      const headline = screen.getByText('Your order is with the kitchen')
      expect(headline.getAttribute('tabindex')).toBe('-1')
    })
  })

  describe('status pill', () => {
    it.each([
      ['received', 'Confirmed', 'bg-accent'],
      ['preparing', 'Preparing', 'bg-info'],
      ['ready', 'Ready', 'bg-success'],
      ['completed', 'Completed', 'bg-surface-overlay'],
    ] as const)(
      'renders pill label "%s" with correct bg class for %s status',
      (status, label, bgClass) => {
        render(<OrderConfirmationScreen {...defaultProps} initialStatus={status} />)
        const pill = screen.getByRole('status')
        expect(pill.textContent).toContain(label)
        expect(pill.className).toContain(bgClass)
      },
    )

    it('pill has aria-live="polite"', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      const pill = screen.getByRole('status')
      expect(pill.getAttribute('aria-live')).toBe('polite')
    })

    it('preparing pill has animate-pulse class', () => {
      render(<OrderConfirmationScreen {...defaultProps} initialStatus="preparing" />)
      const pill = screen.getByRole('status')
      expect(pill.className).toContain('animate-pulse')
    })
  })

  describe('polling', () => {
    it('does NOT set up interval when initialStatus is completed', () => {
      vi.useFakeTimers()
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="completed" />)

      expect(setIntervalSpy).not.toHaveBeenCalled()
      setIntervalSpy.mockRestore()
    })

    it('sets up a 4000ms interval when status is not completed', () => {
      vi.useFakeTimers()
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 4000)
      setIntervalSpy.mockRestore()
    })

    it('polling tick that returns a new status updates the pill label', async () => {
      vi.useFakeTimers()
      resetPollMock({ data: { id: 'o-1', status: 'preparing' }, error: null })

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)

      expect(screen.getByRole('status').textContent).toContain('Confirmed')

      await act(async () => {
        vi.advanceTimersByTime(4000)
        await Promise.resolve()
      })

      expect(screen.getByRole('status').textContent).toContain('Preparing')
    })

    it('polling stops when status reaches completed (no interval on re-render)', async () => {
      vi.useFakeTimers()
      resetPollMock({ data: { id: 'o-1', status: 'completed' }, error: null })

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)

      // First tick transitions to completed
      await act(async () => {
        vi.advanceTimersByTime(4000)
        await Promise.resolve()
      })

      expect(screen.getByRole('status').textContent).toContain('Completed')

      const callsBefore = pollSingleMock.mock.calls.length

      // Advance another 4s — no further polls should happen
      await act(async () => {
        vi.advanceTimersByTime(4000)
        await Promise.resolve()
      })

      expect(pollSingleMock.mock.calls.length).toBe(callsBefore)
    })

    it('clears interval on unmount', () => {
      vi.useFakeTimers()
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { unmount } = render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)
      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('initial status renders immediately without flashing (no state change on first paint)', () => {
      // If the component reads initialStatus into useState correctly, the first render
      // should show the correct pill without waiting for an effect.
      render(<OrderConfirmationScreen {...defaultProps} initialStatus="preparing" />)
      expect(screen.getByRole('status').textContent).toContain('Preparing')
    })

    it('poll error is silent — status does not change, no error surfaces in UI', async () => {
      vi.useFakeTimers()
      resetPollMock({ data: null, error: { code: 'PGRST116', message: 'no rows' } })

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)
      expect(screen.getByRole('status').textContent).toContain('Confirmed')

      await act(async () => {
        vi.advanceTimersByTime(4000)
        await Promise.resolve()
      })

      // Status unchanged after a failed poll
      expect(screen.getByRole('status').textContent).toContain('Confirmed')
      // No alert / error region surfaces
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('poll returning an invalid status string does NOT update local state', async () => {
      vi.useFakeTimers()
      resetPollMock({ data: { id: 'o-1', status: 'shipped' }, error: null })

      render(<OrderConfirmationScreen {...defaultProps} initialStatus="received" />)

      await act(async () => {
        vi.advanceTimersByTime(4000)
        await Promise.resolve()
      })

      // Invalid status ignored; pill still shows initial
      expect(screen.getByRole('status').textContent).toContain('Confirmed')
    })
  })

  describe('accessibility', () => {
    it('headline element receives focus on mount', () => {
      render(<OrderConfirmationScreen {...defaultProps} />)
      const headline = screen.getByText('Your order is with the kitchen')
      expect(document.activeElement).toBe(headline)
    })
  })

  describe('translation rendering', () => {
    it('renders item name from translations when present for active lang', () => {
      const items = [
        {
          name: 'Burger',
          quantity: 1,
          variantNames: [],
          translations: { es: { name: 'Hamburguesa' } },
        },
      ]
      render(<OrderConfirmationScreen {...defaultProps} items={items} lang="es" />)
      expect(screen.getByText('1× Hamburguesa')).toBeDefined()
    })

    it('falls back to stored name when translations field is absent (pre-10.2 order)', () => {
      const items = [{ name: 'Burger', quantity: 1, variantNames: [] }]
      render(<OrderConfirmationScreen {...defaultProps} items={items} lang="es" />)
      expect(screen.getByText('1× Burger')).toBeDefined()
    })

    it('headline/subhead/pill come from chrome bundle keyed by status', () => {
      const chrome = makeChrome({
        'order.headline.preparing': 'CUSTOM HEADLINE',
        'order.subhead.preparing': 'CUSTOM SUBHEAD',
        'order.pill.preparing': 'CUSTOM PILL',
      })
      render(
        <OrderConfirmationScreen
          {...defaultProps}
          initialStatus="preparing"
          chrome={chrome}
        />,
      )
      expect(screen.getByText('CUSTOM HEADLINE')).toBeDefined()
      expect(screen.getByText('CUSTOM SUBHEAD')).toBeDefined()
      expect(screen.getByRole('status').textContent).toContain('CUSTOM PILL')
    })

    it('table caption interpolates restaurantName and tableNumber', () => {
      render(<OrderConfirmationScreen {...defaultProps} restaurantName="Acme" tableNumber={9} />)
      expect(screen.getByText('Acme · Table 9')).toBeDefined()
    })
  })
})
