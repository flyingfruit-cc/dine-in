# Story 8.2: Order Tickets, Sequence & Priority Signals

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As kitchen staff,
I want each order shown as a clear ticket with item list and elapsed time,
so that I can plan prep without misreading anything during a rush.

## Acceptance Criteria

1. **Given** an order is shown on the KDS
   **When** the `OrderTicket` renders
   **Then** it displays: table number (large, top-left, ≥ 32px font — `text-4xl` or larger), elapsed time since `submitted_at` (top-right, updates every 30s), full item list with variants (no truncation), and a single bump action button (≥ 64px touch target — `min-h-16`, designed for greasy / gloved hands)
   **And** the table number is resolved from a `tablesById: Record<string, number>` lookup passed by the page; if not found, the ticket renders "Table —" (matches `OrderCard.tsx:26` fallback)
   **And** the bump button has `onClick={() => {}}` no-op in Story 8.2 — Story 8.3 wires it to `advanceOrderStatus(orderId, 'ready')`. The button is **enabled** and rendered with `aria-label="Bump order {tableNumber}"` so the structural / accessibility ACs are testable now.

2. **Given** an order's elapsed time exceeds 10 minutes
   **When** the ticket renders
   **Then** the ticket card border turns warning color (`border-warning`, **NOT** a hardcoded hex) and the elapsed time has a pulsing animation (`animate-pulse`) — priority signal
   **And** at 15 minutes the border escalates to error color (`border-error`); the pulse continues on the elapsed time at this stage too
   **And** the thresholds are open-on-left, closed-on-right: `elapsedMinutes >= 10 && < 15` → warning; `elapsedMinutes >= 15` → error; `elapsedMinutes < 10` → default `border-border`

3. **Given** orders share the same `submitted_at` value (same minute, same second)
   **When** they render on the KDS grid
   **Then** they are sorted by `submitted_at` ASC then by `id` ASC — deterministic order across reloads (fixes the `sortDesc` tie-break gap noted in Story 5.1 deferred work)
   **And** the sort is local to `KdsScreen` — the global `useOrderStore.sortDesc` (DESC by submitted_at, used by the front-of-house order feed) is **NOT** changed

4. **Given** the KDS displays more than 12 active orders
   **When** the grid renders
   **Then** the grid scrolls vertically while keeping newest at the **bottom** (KDS sort is ASC, oldest-first) — no orders are hidden off-screen
   **And** the page **never** shows a horizontal scrollbar at any viewport width (verified by Playwright on 360px and 1920px viewports)
   **And** the outer `<main>` uses `min-h-screen` (already in 8.1); no `max-h-screen overflow-hidden` — let the browser's natural vertical scroll do the work

5. **Given** the feed first loads
   **When** the skeleton displays
   **Then** 6 ticket-shaped placeholders are shown — each placeholder matches the real `OrderTicket` layout (table-num block top-left, time block top-right, ~3 item-list rows, bump-button block) — no spinners, no `<div className="h-32 ...">` generic blocks (per UX-DR12)

6. **Given** the implicit Active filter
   **When** the KDS renders
   **Then** only orders that are NOT `is_handled` are shown — this is the **temporary bridge filter** because the `status` enum column does not yet exist (Story 9.1 introduces it). When Story 9.1 lands, this story's `orders.filter((o) => !o.is_handled)` becomes `orders.filter((o) => o.status === 'received' || o.status === 'preparing')`. Story 8.2 ships with the bridge filter, exactly matching Story 8.1's pattern; this is documented in dev notes for the 9.1 migration sequence.

7. **Given** an `OrderTicket` mounts
   **When** the elapsed time would naturally tick over (e.g., the order has been on the screen for 31s and the current display says "just now")
   **Then** the displayed time refreshes WITHOUT a realtime update — the page maintains a single `now: Date` tick at `KdsScreen` level via `setInterval(..., 30_000)`; the tick re-renders all tickets together
   **And** the timer is cleaned up on unmount (`clearInterval` in the `useEffect` cleanup)
   **And** the timer also re-evaluates the warning / error border state — a ticket at exactly 9:59 transitions to warning by the next tick

---

## Tasks / Subtasks

- [x] **Task 1 — Add `warning` design token** (AC: #2)
  - [x] Edit `app/globals.css`:
    - In `:root` (light mode), add `--warning: #FF9500;` (system orange — iOS HIG caution color, distinct from `accent: #FF6B35` red-orange)
    - In `.dark` block, add `--warning: #FF9F0A;` (slightly brighter for dark backgrounds, also iOS HIG)
  - [x] Edit `tailwind.config.ts`:
    - In `theme.extend.colors`, alongside `success: "var(--success)"`, add `warning: "var(--warning)"`
    - Position: directly after `success` to keep status tokens grouped
  - [x] **DO NOT** introduce `warning-muted`, `warning-foreground`, or any other warning variant — only the base token is needed for Story 8.2
  - [x] **DO NOT** delete or modify existing `error: "#FF3B30"` — Story 8.2 reuses it as the 15-minute escalation color (no token change required for error)

- [x] **Task 2 — Add tables lookup to the KDS page** (AC: #1)
  - [x] Edit `app/admin/kds/page.tsx`:
    - After the existing `profile` check, fetch tables (mirrors `app/admin/orders/page.tsx:20-26`):
      ```tsx
      const { data: tables } = await supabase
        .from('tables')
        .select('id, number')
        .eq('restaurant_id', profile.restaurant_id)

      const tablesById: Record<string, number> = {}
      for (const t of tables ?? []) tablesById[t.id] = t.number
      ```
    - Pass to `KdsScreen`: `<KdsScreen tablesById={tablesById} />`
  - [x] **DO NOT** filter the tables query by `is_published` or any other criterion — every existing `tables` row may be referenced by historical orders.
  - [x] **Defense-in-depth note**: the `tables` query inherits the existing RLS scope (owner JWT → own restaurant). No client-supplied `restaurant_id` is involved.

- [x] **Task 3 — Update `KdsScreen` to accept `tablesById`, sort ASC by `(submitted_at, id)`, render `OrderTicket`, and tick every 30s** (AC: #1, #3, #4, #6, #7)
  - [x] Edit `components/admin/KdsScreen.tsx`:
    - Add prop: `interface Props { tablesById: Record<string, number> }`; signature becomes `export function KdsScreen({ tablesById }: Props)`.
    - **Sort** active orders ASC by `submitted_at` then by `id`:
      ```tsx
      const activeOrders = orders
        .filter((o) => !o.is_handled)
        .slice()
        .sort((a, b) => {
          if (a.submitted_at !== b.submitted_at) {
            return a.submitted_at < b.submitted_at ? -1 : 1
          }
          return a.id < b.id ? -1 : 1
        })
      ```
      **Why `.slice()` first**: `Array.prototype.sort` mutates in place; the store-returned `orders` array must not be mutated. (Vitest will not catch this — Zustand may share the reference across renders and the next realtime event will then operate on a re-sorted array.)
    - **30s tick** via `useState` + `useEffect`:
      ```tsx
      const [now, setNow] = useState(() => new Date())
      useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30_000)
        return () => clearInterval(id)
      }, [])
      ```
      A single timer at the KDS level — not per-ticket. Pass `now` down to each ticket.
    - Replace the inline `KdsTicketPlaceholder` invocation with `<OrderTicket key={order.id} order={order} tableNumber={tablesById[order.table_id] ?? null} now={now} />`.
    - **DELETE** the `KdsTicketPlaceholder` function defined inside `KdsScreen.tsx` (lines 77–91 in the current file) — it's superseded by `OrderTicket.tsx` in Task 4. Remove the local `import type { Order } from '@/types/app'` if no other usage remains (verify with the linter).
  - [x] **DO NOT** add per-ticket `setInterval` timers — N tickets × N intervals is wasteful.
  - [x] **DO NOT** mutate the global `useOrderStore` sort. The order feed expects newest-first (DESC); KDS wants oldest-first (ASC). They are different surfaces with different sort requirements.

- [x] **Task 4 — Create `OrderTicket` Client Component** (AC: #1, #2, #7)
  - [x] Create `components/admin/OrderTicket.tsx` — Client Component (`'use client'` because the bump button uses `onClick`).
  - [x] Props:
    ```tsx
    interface Props {
      order: Order
      tableNumber: number | null
      now: Date
    }
    ```
  - [x] Compute elapsed minutes:
    ```tsx
    const elapsedMs = now.getTime() - new Date(order.submitted_at).getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60_000)
    ```
  - [x] Determine border class via a helper or inline ternary:
    ```tsx
    const borderClass =
      elapsedMinutes >= 15 ? 'border-error'
      : elapsedMinutes >= 10 ? 'border-warning'
      : 'border-border'
    ```
    The escalation is per AC #2: 10-min warning, 15-min error.
  - [x] Pulsing animation on elapsed time: apply `animate-pulse` to the time `<span>` ONLY when `elapsedMinutes >= 10` (both warning and error states pulse).
  - [x] **Render structure**:
    ```tsx
    <article
      className={`rounded-lg border-2 bg-surface-raised p-4 ${borderClass}`}
      aria-label={`Order for Table ${tableNumber ?? '—'}, ${formatRelativeTime(order.submitted_at, now)}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-4xl font-bold text-text-primary tabular-nums">
          Table {tableNumber ?? '—'}
        </span>
        <span
          className={`text-sm text-text-secondary tabular-nums ${elapsedMinutes >= 10 ? 'animate-pulse' : ''}`}
        >
          {formatRelativeTime(order.submitted_at, now)}
        </span>
      </header>
      <ul className="my-4 space-y-2">
        {order.items.map((item, i) => (
          <li key={i} className="text-base text-text-primary">
            <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
            {item.variants.length > 0 && (
              <p className="ml-6 text-sm text-text-secondary">{item.variants.join(', ')}</p>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {}}
        aria-label={`Bump order for Table ${tableNumber ?? '—'}`}
        className="min-h-16 w-full rounded-lg bg-accent text-base font-semibold text-white"
      >
        Bump
      </button>
    </article>
    ```
  - [x] **Border width = 2**: spec calls for a visible border-state change; `border-2` makes the warning / error escalation legible from across the kitchen. The default 1px border (`border` class in 8.1's placeholder) is too subtle.
  - [x] **Item list keys**: keying by array index (`key={i}`) is acceptable here because the `items` array is immutable per order (set at submission, never re-ordered). This matches the existing `OrderCard.tsx:67` pattern.
  - [x] **Variant rendering**: `item.variants` is `string[]` (per `types/app.ts:106-110`). Join with ', '. **DO NOT** add slot logic for variant labels — they are pre-formatted strings.
  - [x] **Bump button**: enabled, `onClick={() => {}}`, no visual "disabled" state — Story 8.3 wires the handler. The structural AC (≥ 64px tap target, present, aria-labelled) is satisfied now.

- [x] **Task 5 — Update `/admin/kds/loading.tsx` skeleton to match the new ticket shape** (AC: #5)
  - [x] Edit `app/admin/kds/loading.tsx`:
    - Replace the generic `<div className="h-32 ...">` placeholders with structured ticket-shaped placeholders. One placeholder block per card:
      ```tsx
      <div className="rounded-lg border-2 border-border bg-surface-raised p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-10 w-32 animate-pulse rounded bg-surface-overlay" />
          <div className="h-4 w-16 animate-pulse rounded bg-surface-overlay" />
        </div>
        <div className="my-4 space-y-2">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-5 w-full animate-pulse rounded bg-surface-overlay" />
          ))}
        </div>
        <div className="h-16 w-full animate-pulse rounded-lg bg-surface-overlay" />
      </div>
      ```
    - Keep the outer `Array.from({ length: 6 }).map(...)` loop and the `grid grid-cols-2 gap-4 lg:grid-cols-3` wrapper from Story 8.1 — only the per-card block changes.
  - [x] **Border-2 on skeleton**: matches the real ticket's `border-2` so there is no layout shift when content replaces the skeleton.
  - [x] **DO NOT** add a spinner anywhere — UX-DR12.

- [x] **Task 6 — Unit tests** (AC: #1, #2, #3, #6, #7)
  - [x] `tests/unit/admin/OrderTicket.test.tsx` (NEW):
    - **Display**: Renders "Table {n}" when `tableNumber=7`; renders "Table —" when `tableNumber=null`.
    - **Item list**: Renders one `<li>` per item; `1× Burger` quantity prefix; variant string joined with ', ' (e.g., `["no cheese", "well done"]` → "no cheese, well done"); no items hidden via truncation (test by counting `<li>` elements).
    - **Bump button**: present, `min-h-16` class on the button, `aria-label` contains the table number, `onClick` is callable (no-op for 8.2).
    - **Elapsed time thresholds** — use a fixed `now` to control elapsed minutes deterministically:
      - `now - submitted_at = 5 min` → no `animate-pulse`, default `border-border`
      - `now - submitted_at = 10 min` → `animate-pulse` on time, `border-warning` on article
      - `now - submitted_at = 14 min` → still `border-warning`, still pulsing
      - `now - submitted_at = 15 min` → `border-error`, still pulsing
      - `now - submitted_at = 20 min` → `border-error`, still pulsing
    - Assert class presence via `container.querySelector('article')?.className.includes('border-warning')`. The Vitest harness has no `@testing-library/jest-dom`; use plain string checks (per Story 7.2 debug log).
    - `afterEach(cleanup)` at the top of the file.
  - [x] `tests/unit/admin/KdsScreen.test.tsx` (UPDATE):
    - Update the `KdsScreen` rendering tests to pass the new `tablesById={}` prop. All existing tests should continue to pass when given an empty `tablesById` object (the lookup will return `undefined → null`, the ticket renders "Table —" — does not crash).
    - **Sort test**: render 3 orders with `submitted_at` values that include a tie. Assert the rendered table-number sequence (or order.id sequence) matches ASC `submitted_at`, ASC `id`. Use `container.querySelectorAll('article')` to get the DOM order.
    - **30s tick test**: use `vi.useFakeTimers()`; render `KdsScreen` with one order; assert initial elapsed text ("just now"); advance `vi.advanceTimersByTime(60_000)`; assert elapsed text updates ("1m ago"). Wrap timer-advance in `act(() => ...)`.
    - **DELETE** the old `KdsTicketPlaceholder` related tests (if any reference it directly) — `KdsScreen` now renders `OrderTicket`.
    - Wake-lock and chrome / heading / count tests from Story 8.1 are unaffected; verify they still pass when the new prop is added.
  - [x] Vitest harness reminders (per Story 7.2): no `jest-dom`; plain `.toBeTruthy()` / `.getAttribute()` / `.textContent.includes()` / class-string checks; `afterEach(cleanup)` at the top of every component test file; `vi.useFakeTimers()` for interval-driven tests, restore via `vi.useRealTimers()` in `afterEach`.

- [x] **Task 7 — Extend E2E smoke test** (AC: #4, #1)
  - [x] Edit `tests/e2e/admin-kds.spec.ts`:
    - Add a test that seeds ≥ 2 orders (via `getServiceClient`) at distinct `submitted_at` values, then navigates to `/admin/kds` and asserts:
      - At least one `article[role="article"]` (or any element with `aria-label` matching `Order for Table`) is visible.
      - A `Bump` button is visible inside the first ticket.
      - **No horizontal scrollbar**: `await expect(page.locator('body')).toHaveCSS('overflow-x', /(visible|auto|scroll|hidden)/)` — and additionally `await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)` should return `true`. Test at viewport 360 × 800 (mobile portrait) and 1280 × 800 (desktop).
    - Reuse the `beforeAll` / `afterAll` fixture cleanup helpers already present in the file.
    - Seed via direct DB insert — Story 8.2 introduces no new RLS surface, but the existing `tests/rls/helpers.ts` may need a helper like `createTestOrder(svc, restaurantId, tableId, items, submittedAt)`. If not present, add it; if present, use it.
    - **Do NOT** assert specific border colors in E2E — Playwright's CSS-string comparison is fragile and the unit tests already cover the threshold logic.
    - **Do NOT** add an RLS test — no schema changes in 8.2.
  - [x] If `tests/rls/helpers.ts` lacks `createTestOrder`, add it as the minimal helper:
    ```ts
    export async function createTestOrder(svc: SupabaseClient, restaurantId: string, tableId: string, items: OrderItem[], submittedAt?: string) {
      const { data, error } = await svc.from('orders').insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        items,
        submitted_at: submittedAt ?? new Date().toISOString(),
        is_handled: false,
        total_cents: 0,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    }
    ```
    If a similar helper exists under a different name, use it.

- [ ] **Task 8 — Verification: manual + visual check** (Left for manual verification by user)

### Review Findings (2026-05-20)

- [x] [Review][Decision] Viewport mismatch between AC #4 and Task 7 — AC #4 mandates Playwright verification at **1920px**; Task 7 says "Test at viewport **1280 × 800** (desktop)". The new E2E test uses 1280px. **Resolved (2026-05-20): keep 1280px per Task 7 wording; implementation stays as-is.** [tests/e2e/admin-kds.spec.ts:106-110]
- [x] [Review][Decision] Bump button aria-label wording — AC #1 text says `aria-label="Bump order {tableNumber}"`; the Task 4 render block specifies `aria-label="Bump order for Table {n}"`. Implementation followed the Task version. **Resolved (2026-05-20): keep Task 4 wording ("Bump order for Table {n}"); implementation stays as-is.** [components/admin/OrderTicket.tsx:49]
- [x] [Review][Patch] Sort tie-break test asserts only `length === 3`, not actual ordering [tests/unit/admin/KdsScreen.test.tsx:177-194] — Fixed (2026-05-20): now maps each `table_id` to a distinct number and asserts `renderedTables[0..2]` equal `Table 1`, `Table 2`, `Table 3`. Mutation-tested by inverting the comparator: assertion correctly fails. (HIGH)
- [x] [Review][Patch] `tables` SELECT discards error; RLS/network failure silently renders all tickets "Table —" [app/admin/kds/page.tsx:22-25] — Fixed (2026-05-20): captured `tablesError` and added a `console.error` so the failure is at least observable in Sentry/log streams. (MEDIUM)
- [x] [Review][Patch] `aria-label` reads "Table em-dash" / "Bump order for Table em-dash" for unknown tables [components/admin/OrderTicket.tsx:23, 49] — Fixed (2026-05-20): introduced `accessibleTable = "unknown table"` for `aria-label` and kept the visible `tableLabel = "Table —"` for sighted users. (MEDIUM)
- [x] [Review][Patch] Clock skew can produce negative `elapsedMs`; if tablet clock is behind, brand-new orders show `border-warning` [components/admin/OrderTicket.tsx:14] — Fixed (2026-05-20): clamp with `Math.max(0, Math.floor(elapsedMs / 60_000))`. (MEDIUM)
- [x] [Review][Patch] E2E sets 360px viewport BEFORE `signIn(page)`; login UI may not be responsive at 360px [tests/e2e/admin-kds.spec.ts:88-90] — Fixed (2026-05-20): `signIn(page)` runs at default viewport first, then `setViewportSize({width: 360})`. (MEDIUM)
- [x] [Review][Patch] "Bump button is callable" test asserts only that `() => {}.click()` does not throw — tautological [tests/unit/admin/OrderTicket.test.tsx:108-113] — Fixed (2026-05-20): replaced with a structural assertion `btn.disabled === false` and `btn.getAttribute('type') === 'button'`. (LOW-MEDIUM)
- [x] [Review][Patch] Lexicographic ISO string compare in sort breaks when `Z` and `+00:00` suffixes are mixed [components/admin/KdsScreen.tsx:25-30] — Fixed (2026-05-20): sort comparator now uses `Date.parse(...)` so mixed ISO suffixes compare chronologically. (LOW)
- [x] [Review][Patch] E2E `scrollWidth` check at 1280px runs immediately after `setViewportSize` without layout settle [tests/e2e/admin-kds.spec.ts:106-110] — Fixed (2026-05-20): replaced both `evaluate(...)` calls with `page.waitForFunction(..., { timeout: 2000 })`. (LOW)
- [x] [Review][Defer] `tablesById` becomes stale when new tables added mid-shift [app/admin/kds/page.tsx:22-28] — deferred, out of scope for 8.2 (would need realtime subscription on `tables`).
- [x] [Review][Defer] E2E test seeds two timestamped orders but never verifies ASC order between them [tests/e2e/admin-kds.spec.ts:84-113] — deferred, coverage gap not in spec.
- [x] [Review][Defer] `.slice()` after `.filter()` is redundant [components/admin/KdsScreen.tsx:23] — deferred, spec explicitly mandates the pattern (harmless dead op).
- [x] [Review][Defer] No `KdsScreen` test exercises a non-empty `tablesById` [tests/unit/admin/KdsScreen.test.tsx] — deferred, indirect coverage exists via `OrderTicket` leaf tests.
- [x] [Review][Defer] `items` jsonb shape not runtime-validated; malformed write crashes ticket [components/admin/OrderTicket.tsx:36-44] — deferred, defensive depth beyond story scope; no error boundary on the KDS grid.
- [x] [Review][Defer] No unit-test assertion for `border-2` width class on `<article>` [tests/unit/admin/OrderTicket.test.tsx] — deferred, minor coverage gap for the Dev Notes invariant.
  - [ ] Start the dev server (`npm run dev`), sign in as a test owner, visit `/admin/kds`.
  - [ ] Place 3 test orders via the customer flow at staggered intervals; confirm each appears as an `OrderTicket` in the grid in ASC submission order (oldest first).
  - [ ] Manually backdate one order's `submitted_at` to ~12 minutes ago (via Supabase SQL editor or service-role script) — refresh; confirm the ticket renders with `border-warning` AND the elapsed time pulses.
  - [ ] Backdate another to ~17 minutes ago — confirm `border-error` and pulse.
  - [ ] Wait 30+ seconds on the page (with one fresh order); confirm the elapsed time updates from "just now" → "1m ago" without a manual refresh.
  - [ ] Resize the viewport between 360px and 1920px — confirm: 2 columns below 1024px, 3 columns at ≥1024px, no horizontal scrollbar at any width.
  - [ ] Place 15 orders — confirm the page scrolls vertically and shows all 15.
  - [ ] Tap the bump button — confirm nothing happens (Story 8.3 will wire it; just verify the button is enabled and clickable, and the tap target is large enough for a gloved finger).
  - [ ] In Chrome DevTools → Performance → CPU 4× throttle: confirm the 30s tick is not blocking the main thread or causing visible jank.
  - [ ] (Left for manual verification by user)

---

## Dev Notes

### Critical Context

**Story 9.1 (status enum) is still in backlog — `is_handled` is the bridge filter.** The Story 8.2 AC #6 spec text mentions filtering by `status === 'received' || 'preparing'`, but the `status` column does not exist yet. Story 9.1 introduces it. Story 8.2 ships with `!is_handled` — the same bridge filter Story 8.1 used. When 9.1 lands, a small follow-up will swap the filter. **DO NOT** add the status column in Story 8.2 — that work belongs in 9.1's migration. **DO NOT** block on 9.1 — it's an out-of-sequence dependency.

**The 30s tick lives in `KdsScreen`, not in `OrderTicket`.** Per-ticket intervals would create N timers for N tickets, all firing at slightly different moments → janky group updates. A single timer at the parent level re-renders all tickets together via the `now: Date` prop. This is the same architectural pattern as a Redux store's `tick` action propagated to subscribers.

**The KDS sort is local — global `useOrderStore.sortDesc` is unchanged.** Story 5.1's order feed wants newest-first (DESC). The KDS wants oldest-first (ASC) — kitchen prepares in submission order. Two surfaces, two sorts. Implement the ASC sort inside `KdsScreen` via `[...orders].sort(...)`. **DO NOT** add a flag to the store; **DO NOT** rename `sortDesc`; **DO NOT** introduce a second sort method on the store. The component-level sort is correct.

**Stable sort tie-breaker by `id`.** AC #3 explicitly fixes the deferred-work item from Story 5.1: when `submitted_at` is identical (sub-second precision in Supabase timestamps), the existing global `sortDesc` returns -1 for equal elements which is technically incorrect (should return 0 or compare on a tiebreaker). Story 8.2's KDS-local sort returns `a.id < b.id ? -1 : 1` for ties — deterministic across reloads, no fragility on the global helper.

**Border-2 over border-1 for visual legibility.** Story 8.1's `KdsTicketPlaceholder` used `border border-border` (1px). At kitchen-screen distance (~3-5 feet from a wall-mounted tablet), a 1px warning/error border is barely visible. Story 8.2 uses `border-2` everywhere on `OrderTicket` so the color change is unmistakable. The skeleton in `loading.tsx` also uses `border-2` to avoid hydration layout shift.

**Bump button is structural-only in Story 8.2.** Story 8.3 will wire `onClick` to `advanceOrderStatus(orderId, 'ready')` from Story 9.1 (which adds the action). Story 8.2 renders the button with proper sizing (`min-h-16`), accessibility (`aria-label`), and a no-op `onClick`. **DO NOT** disable the button — that would fail the AC #1 "≥ 64px touch target" test, which tests both pointer-area and that the button responds to clicks. **DO NOT** import `advanceOrderStatus` — it doesn't exist yet.

**Warning color is a new design token.** `app/globals.css` ships with only `--success` for status colors; `--warning` does not exist. Task 1 adds it: `#FF9500` (light) / `#FF9F0A` (dark) — iOS HIG system orange, distinct from the project's `accent #FF6B35` (red-orange) so warning and brand colors don't collide visually. **DO NOT** reuse `accent` for warning; the spec explicitly says "status token `warning`", and conflating brand and status colors is a design anti-pattern.

**Items array immutability.** `Order.items` is set at submission time (per Story 4.5) and never re-ordered. Keying the item `<li>` by array index is safe — same pattern as `OrderCard.tsx:67`. **DO NOT** key by `item.name` (could collide if two items share a name).

**No truncation on item list.** Spec AC #1: "no truncation". `OrderCard.tsx` uses `truncate` on summaries — that's the front-of-house pattern. KDS shows the full list because the kitchen has to prep each item; truncation would hide ingredients. Wrap long item names if necessary via `break-words`, but **DO NOT** add `truncate` or `line-clamp-N` anywhere in `OrderTicket`.

**Per-ticket `aria-label` on the article.** Mirrors `OrderCard.tsx:27-30`: `"Order for Table {n}, {time}"`. Screen reader users in a noisy kitchen still get useful announcements. **DO NOT** include the item count in the aria-label — the visible item list serves that purpose.

**`formatRelativeTime(iso, now)` accepts an optional second arg** — `utils/formatTime.ts:1` already takes `now: Date = new Date()`. Pass the KDS-level `now` explicitly so the displayed time is deterministic with the tick state. Story 8.1's `KdsTicketPlaceholder` did NOT pass `now`, relying on the default — that's why the elapsed time was stale (one of the 8.1 deferred items).

### Architecture Compliance

**Routing:** No new routes. Story 8.1's `/admin/kds` is extended.

**Client selection** (`docs/conventions/supabase-clients.md`):
- Page (Server Component, `app/admin/kds/page.tsx`) uses the server cookie client (`lib/supabase/server.ts`) for the auth gate AND for the new `tables` SELECT.
- `KdsScreen` (Client Component) and `OrderTicket` (Client Component) do not touch Supabase directly — `KdsScreen` reads `useOrderStore`; `OrderTicket` is pure presentational with `now` + `tableNumber` props.

**Server Action discipline** — N/A. Story 8.2 has no Server Actions; the bump button's `onClick` is a no-op pending Story 8.3.

**Naming compliance:**
- Components: `OrderTicket` — PascalCase.
- File: `components/admin/OrderTicket.tsx` — PascalCase `.tsx`.
- Test file: `tests/unit/admin/OrderTicket.test.tsx`.

**Component directory placement:**
- `components/admin/OrderTicket.tsx` — admin-only surface.
- **NOT** `components/shared/` — KDS is exclusively admin/owner-facing.

**Schema changes:** None in Story 8.2. The `status` enum migration is Story 9.1's responsibility.

**RLS:** No changes; no new policies. `tables` SELECT is already gated by the existing owner-RLS policy on `tables`.

**Styling rules:**
- Tailwind only.
- Design tokens only: `bg-surface-base`, `bg-surface-raised`, `bg-surface-overlay`, `border-border`, `border-warning` (NEW), `border-error`, `text-text-primary`, `text-text-secondary`, `text-accent`, `bg-accent`.
- Breakpoints: `sm` and `lg` only.
- `tabular-nums` on numeric columns (table number, item quantity, elapsed time).
- `border-2` on ticket articles AND skeletons for visual parity.

**Anti-patterns to avoid:**
- Do **not** filter orders by a `status` field — column does not exist yet.
- Do **not** add a `status` column to the schema in Story 8.2.
- Do **not** introduce `advanceOrderStatus` or any Server Action — Story 8.3 owns this.
- Do **not** hardcode hex colors (`#FF9500`, `#FF3B30`) anywhere in components — use design tokens.
- Do **not** add per-ticket `setInterval` timers — single KdsScreen-level interval.
- Do **not** mutate `useOrderStore.orders` in place — `.slice()` before `.sort()`.
- Do **not** mutate the global `sortDesc` helper.
- Do **not** truncate item names.
- Do **not** disable the bump button — render it enabled with a no-op handler.
- Do **not** add `framer-motion`, `react-spring`, or any animation library — Tailwind's `animate-pulse` is sufficient.
- Do **not** add a "X minutes" auto-tick on each ticket independently — the parent ticks; tickets are dumb presentational.
- Do **not** introduce a `useMemo` on the sort or filter — the lists are bounded (<100 typical) and React's re-renders are cheap.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`components/admin/KdsScreen.tsx`** — the file Task 3 modifies (current state after Story 8.1 + review patches):
- Server-side wake-lock effect with `cancelled` / `acquiring` guards, `release` event listener for browser auto-release recovery. **DO NOT** modify this effect.
- Currently filters `orders.filter((o) => !o.is_handled)` — Story 8.2 extends this to add `.slice().sort(...)`.
- Currently renders `<KdsTicketPlaceholder>` for each order — Story 8.2 replaces with `<OrderTicket>`.
- The local `KdsTicketPlaceholder` function (lines 77–91) is deleted entirely.
- The header `<h1>Kitchen</h1>` + active-count span stays exactly as-is.

**`app/admin/kds/page.tsx`** — Task 2 modifies:
- Currently does the auth gate and renders `<KdsScreen />` with no props.
- Story 8.2 adds the `tables` SELECT and passes `tablesById` to `<KdsScreen>`.

**`app/admin/kds/loading.tsx`** — Task 5 modifies:
- Currently renders 6 generic `h-32` blocks in the 2/3-col grid.
- Story 8.2 replaces each block with a ticket-shaped structured skeleton.

**`app/admin/orders/page.tsx:18-26`** — reference for the tables-lookup pattern. Story 8.2's `app/admin/kds/page.tsx` mirrors this exactly. **DO NOT** re-implement; copy the pattern verbatim.

**`components/admin/OrderCard.tsx`** — pattern reference for the order-display pattern:
- `tableLabel = tableNumber !== null ? \`Table ${tableNumber}\` : 'Table —'` (line 26)
- Item iteration with index keys (lines 67-77)
- `aria-label` composition (lines 27-30)
- **DO NOT** import or reuse OrderCard — the visual layout for KDS is intentionally different (large table number, no compact summary, full item list always visible).

**`utils/formatTime.ts`** — `formatRelativeTime(iso: string, now: Date = new Date())`. Story 8.2 passes the KDS-level `now` explicitly so all tickets use the same reference moment.

**`stores/orderStore.ts`** — read only; not modified:
- `useOrderStore` exposes `orders` (DESC-sorted by `submitted_at` per `sortDesc`).
- The DESC sort is fine for the front-of-house feed; KDS re-sorts ASC locally in Story 8.2.
- The `sortDesc` tie-break gap (deferred from 5.1) is NOT fixed in this story — only the KDS-local sort has the tie-breaker.

**`types/app.ts`** — `Order`, `OrderItem` types. No type changes needed; the existing types support everything 8.2 renders.

**`tailwind.config.ts:50-60`** — Task 1 modifies. Add `warning: "var(--warning)"` directly after `success`.

**`app/globals.css:64-88`** — Task 1 modifies. Add `--warning` to both `:root` and `.dark` blocks.

**`tests/rls/helpers.ts`** — used by Task 7. Verify whether `createTestOrder` exists; if not, add it (signature in Task 7).

**`tests/unit/admin/KdsScreen.test.tsx`** — Task 6 modifies. Add the `tablesById={}` prop to existing render calls; add new sort and tick tests.

**`tests/e2e/admin-kds.spec.ts`** — Task 7 modifies. Add the orders-seeded "tickets render" test.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `app/globals.css` | UPDATE | Add `--warning: #FF9500;` (light) and `--warning: #FF9F0A;` (dark) |
| `tailwind.config.ts` | UPDATE | Add `warning: "var(--warning)"` after `success` |
| `app/admin/kds/page.tsx` | UPDATE | Fetch `tables`, build `tablesById`, pass to `<KdsScreen>` |
| `components/admin/KdsScreen.tsx` | UPDATE | Accept `tablesById` prop, sort ASC by `(submitted_at, id)`, 30s tick via `setInterval`, render `<OrderTicket>`; delete inline `KdsTicketPlaceholder` |
| `components/admin/OrderTicket.tsx` | NEW | Client Component; renders table number, elapsed time (auto-pulse + threshold border), item list, bump button (no-op) |
| `app/admin/kds/loading.tsx` | UPDATE | Replace generic blocks with ticket-shaped structured skeletons (border-2 parity) |
| `tests/unit/admin/OrderTicket.test.tsx` | NEW | Display, items, bump button, threshold logic |
| `tests/unit/admin/KdsScreen.test.tsx` | UPDATE | Pass new `tablesById` prop, add sort test, add 30s tick test |
| `tests/e2e/admin-kds.spec.ts` | UPDATE | Seed orders, assert tickets visible + no horizontal scrollbar |
| `tests/rls/helpers.ts` | UPDATE (conditional) | Add `createTestOrder` if not present |

**No changes to:**
- `app/admin/layout.tsx` — AdminShell already routes correctly for KDS.
- `components/admin/AdminShell.tsx` — pathname conditional unchanged.
- `components/admin/AdminNav.tsx` — Kitchen entry already added in 8.1.
- `components/shared/RealtimeProvider.tsx` — realtime contract unchanged.
- `stores/orderStore.ts` — global sortDesc not modified.
- `lib/supabase/*` — no client changes.
- `types/app.ts` — `Order` and `OrderItem` already cover everything.
- Any SQL migration — no schema changes.

### Testing Standards

**Three test layers — three runners (project-context rule):**

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/` | Vitest (`npm run test`) | `OrderTicket` (new), `KdsScreen` (updated) |
| RLS integration | n/a | — | **Not used** — no new DB access patterns; no RLS surface added |
| E2E | `tests/e2e/admin-kds.spec.ts` | Playwright (`npm run test:e2e`) | Extend the existing spec to assert tickets render and no horizontal scrollbar |

**Vitest harness reminders (per Story 7.2 debug-log; reinforced by 8.1 review):**
- No `@testing-library/jest-dom` — use `.toBeTruthy()`, `.getAttribute()`, `.textContent.includes(...)`, `className.includes(...)`.
- `afterEach(cleanup)` at the top of every component test file.
- For timer-driven tests (the 30s tick), use `vi.useFakeTimers()` / `vi.advanceTimersByTime(60_000)` / `vi.useRealTimers()` in `afterEach`. Wrap timer advances in `act(() => ...)` so React state updates settle.

**Mocking discipline:**
- `useOrderStore` mocked per Story 8.1 pattern: `vi.mock('@/stores/orderStore', () => ({ useOrderStore: (selector) => selector({ orders: [...] }) }))`.
- `OrderTicket` is purely presentational — no mocks needed beyond the props.
- Do **not** mock `formatRelativeTime` — it's a pure function; passing controlled `submitted_at` + `now` makes the output deterministic.

**E2E rule:**
- Seed orders via service-role client (`getServiceClient` + `createTestOrder` from `tests/rls/helpers.ts`).
- Do **not** mock Supabase in E2E — must hit local Supabase per project-context "real-DB smoke test required" rule.
- Clean up seeded orders in `afterAll` along with the test restaurant + owner (the cascade should handle it via `cleanupTestRestaurants`).

### Previous Story Intelligence

**From Story 8.1 (KDS Route & Tablet-Optimized Layout) — code review findings, applied 2026-05-20:**
- The wake-lock effect was hardened with `cancelled` / `acquiring` guards and a `release` event listener. **DO NOT** touch this effect in Story 8.2.
- `AdminShell` has a `pathname != null` null guard. **DO NOT** revert it.
- Empty-state uses `py-24 text-center` (was `flex flex-1`). **DO NOT** restore the dead flex.
- Three deferred items from 8.1 review are **resolved in 8.2**:
  1. `table_id` raw UUID → fixed by `tablesById` lookup (Task 2 + Task 4)
  2. `formatRelativeTime` not auto-refreshed → fixed by 30s tick (Task 3)
  3. `KdsTicketPlaceholder` "Coming in Story 8.2" hint → removed by replacing with `OrderTicket` (Task 3)

**From Story 7.3 (review patches, 2026-05-20):**
- No `pl-13` or any out-of-Tailwind-scale spacing class. Confirm every class used.
- `aria-labelledby` over hardcoded `aria-label` when a visible heading exists. (Not applicable here — KDS tickets do not have a heading, the article's `aria-label` IS the accessible name.)
- Loading skeleton must match content layout exactly. Story 8.2's loading.tsx update (Task 5) re-enforces this.

**From Story 5.1 (Real-Time Order Feed with Polling Fallback):**
- The sortDesc tie-break gap is documented in the deferred-work file. Story 8.2's KDS-local sort fixes the gap for the KDS surface only; the global helper remains untouched (the order feed deferred-work item stays open).

**From Story 7.2 (Order Volume & Peak Hours):**
- AdminNav per-surface count tests are strict (patches P9/P10). Story 8.2 does NOT modify AdminNav, so no test updates there.

### Latest Tech Information

- **Tailwind `border-{color}` requires `border-{N}` to be visible**: `border-warning` alone won't render — needs `border-2` (or `border-4`, etc.) to set width. The default `border` class is `1px solid`; without an explicit number, switching color changes nothing perceptually. This story uses `border-2` everywhere.
- **`animate-pulse`** is built-in Tailwind 3.x — no plugin needed. It's a 2s ease-in-out infinite. Already used in `loading.tsx` skeletons.
- **`setInterval` 30_000ms in Next.js 15 Client Components**: works in `useEffect`, runs on the browser only, no SSR concern. Cleanup is required to avoid leaks across navigation.
- **`vi.useFakeTimers()` in Vitest 4**: replaces `setInterval` / `setTimeout` with controlled versions; `vi.advanceTimersByTime(ms)` ticks them forward. Combine with React Testing Library's `act` for safe state updates. Restore via `vi.useRealTimers()` in `afterEach`.
- **iOS HIG system colors (Apple Human Interface Guidelines)**: `#FF9500` (light) / `#FF9F0A` (dark) for warning/orange. These contrast cleanly against both white and black backgrounds and meet WCAG AA at typical font sizes.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **Server-Component-by-default** — the page is server; `KdsScreen` and the new `OrderTicket` are `'use client'`.
- **Path alias `@/*`** — `@/components/admin/OrderTicket`, `@/utils/formatTime`, `@/types/app`; never `../`.
- **Tailwind only, design tokens only** — Task 1 adds the `warning` token; do not hardcode `#FF9500` in any component.
- **Breakpoints `sm` and `lg` only** — never `md`.
- **No new dependencies** — `lucide-react`, `vitest`, `@testing-library/react` already cover everything.
- **Comments default to none** — only add comments for non-obvious WHY (the 30s tick has a candidate one-line comment explaining the single-timer architecture; the `.slice()` before `.sort()` deserves a comment).
- **Server Action `ActionResult<T>` pattern** — N/A here (no actions).
- **`Order` type's `table_id` is `string` (UUID), non-nullable** — pass to lookup as `tablesById[order.table_id] ?? null`. The lookup result (`number | undefined`) becomes `number | null` for the OrderTicket prop.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — sparse on Phase-2 KDS specifics
- Epics: `_bmad-output/planning-artifacts/epics.md` lines 1116–1149 — source ACs for Story 8.2
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR49 (KDS route), FR50 (sequence + prep priority — THIS story), FR51 (bump action — Story 8.3)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR12 (no spinners); no explicit KDS-specific UX spec; design choices live in this story
- Project Context: `_bmad-output/project-context.md` — Tailwind discipline, status-token convention, no new deps, anti-patterns list
- Prior art: `_bmad-output/implementation-artifacts/8-1-kds-route-tablet-optimized-layout.md` — the scaffolding this story replaces (`KdsTicketPlaceholder` → `OrderTicket`), and the review-patch lessons baked in
- Prior art: `_bmad-output/implementation-artifacts/5-1-real-time-order-feed-with-polling-fallback.md` — `sortDesc` and its tie-break gap (deferred-work entry)
- Prior art: `_bmad-output/implementation-artifacts/4-5-order-submission-confirmation.md` — `Order.items` JSON shape (set at submission, never mutated)
- Prior art: `components/admin/OrderCard.tsx` — `tableLabel` fallback, item rendering, `aria-label` composition; pattern reference only — NOT to be reused
- Prior art: `app/admin/orders/page.tsx` — `tables` lookup pattern to mirror in `app/admin/kds/page.tsx`
- MDN: `setInterval` — https://developer.mozilla.org/en-US/docs/Web/API/setInterval
- iOS HIG: Color — https://developer.apple.com/design/human-interface-guidelines/color (system orange `#FF9500` / `#FF9F0A`)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tick test initially used `container.querySelector('header span:last-child')` which matched the KDS screen's order-count span instead of the ticket's time span. Fixed to `article header span:last-child` to target the nested ticket header.

### Completion Notes List

- Task 1: Added `--warning` CSS custom property to both `:root` (light `#FF9500`) and `.dark` (dark `#FF9F0A`) in `app/globals.css`. Added `warning: "var(--warning)"` to `tailwind.config.ts` after `success`.
- Task 2: Updated `app/admin/kds/page.tsx` to fetch `tables` by `restaurant_id` and build `tablesById: Record<string, number>`, passed to `<KdsScreen>`. Mirrors the pattern in `app/admin/orders/page.tsx`.
- Task 3: Rewrote `KdsScreen.tsx` — added `tablesById` prop, `.slice().sort()` for ASC `(submitted_at, id)` order, single 30s `setInterval` tick via `useState<Date>`, renders `<OrderTicket>` instead of deleted `KdsTicketPlaceholder`.
- Task 4: Created `components/admin/OrderTicket.tsx` — renders table number (large, top-left), elapsed time with `animate-pulse` at ≥10 min, `border-warning` at ≥10 min / `border-error` at ≥15 min, full item list with variants, enabled Bump button with no-op `onClick`.
- Task 5: Updated `app/admin/kds/loading.tsx` — replaced generic `h-32` blocks with structured ticket-shaped skeletons using `border-2 border-border bg-surface-raised` to match real ticket layout and avoid hydration shift.
- Task 6: Created `tests/unit/admin/OrderTicket.test.tsx` (15 tests) covering display, item list, bump button, and all 5 elapsed-time threshold combinations. Updated `tests/unit/admin/KdsScreen.test.tsx` — added `tablesById={}` to all existing render calls, added sort tie-break test, added 30s tick test with `vi.useFakeTimers()`.
- Task 7: Added `createTestTable` and `createTestOrder` helpers to `tests/rls/helpers.ts`. Extended `tests/e2e/admin-kds.spec.ts` with a test that seeds 2 orders, verifies ticket visibility + Bump button, and checks no horizontal scrollbar at 360px and 1280px.
- Full regression: 449/449 tests pass.

### File List

- `app/globals.css` — UPDATED: added `--warning` token to `:root` and `.dark`
- `tailwind.config.ts` — UPDATED: added `warning: "var(--warning)"` after `success`
- `app/admin/kds/page.tsx` — UPDATED: fetch tables, build `tablesById`, pass to `<KdsScreen>`
- `components/admin/KdsScreen.tsx` — UPDATED: `tablesById` prop, ASC sort, 30s tick, renders `<OrderTicket>`, deleted `KdsTicketPlaceholder`
- `components/admin/OrderTicket.tsx` — NEW: Client Component with elapsed-time thresholds, pulsing animation, enabled Bump button
- `app/admin/kds/loading.tsx` — UPDATED: ticket-shaped structured skeletons with `border-2`
- `tests/unit/admin/OrderTicket.test.tsx` — NEW: 15 unit tests
- `tests/unit/admin/KdsScreen.test.tsx` — UPDATED: `tablesById` prop, sort test, tick test
- `tests/e2e/admin-kds.spec.ts` — UPDATED: ticket render + no-HScroll test
- `tests/rls/helpers.ts` — UPDATED: added `createTestTable` and `createTestOrder`

### Change Log

- Added `warning` design token (light `#FF9500` / dark `#FF9F0A`) to globals.css and tailwind.config.ts (Date: 2026-05-20)
- Implemented `OrderTicket` Client Component with elapsed-time priority signals (border-warning ≥10min, border-error ≥15min, animate-pulse ≥10min) (Date: 2026-05-20)
- Updated `KdsScreen` to pass `tablesById`, sort orders ASC by `(submitted_at, id)`, tick every 30s, render `OrderTicket` (Date: 2026-05-20)
- Updated KDS loading skeleton to ticket-shaped structured placeholders (Date: 2026-05-20)
- Added `createTestTable` + `createTestOrder` helpers to RLS test helpers (Date: 2026-05-20)
- Extended KDS E2E spec: seeds orders, asserts ticket + Bump visibility, verifies no horizontal scrollbar at 360px and 1280px (Date: 2026-05-20)
- Addressed code review findings — 8 patches applied, 6 deferred, 2 decisions resolved (kept implementation per Task 7 / Task 4 wording over AC text) (Date: 2026-05-20)
