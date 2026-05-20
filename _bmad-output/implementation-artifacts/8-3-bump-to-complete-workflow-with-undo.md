# Story 8.3: Bump-to-Complete Workflow with Undo

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As kitchen staff,
I want to bump an order with a single tap when prep is done, with a short undo window,
so that the front of house knows the order is ready without me leaving the kitchen.

## Acceptance Criteria

1. **Given** a ticket is on the KDS
   **When** kitchen staff taps the bump button
   **Then** the order is marked `is_handled = true` via the existing `markOrderHandled(orderId)` Server Action — this is the Story 8.3 bridge for `advanceOrderStatus(orderId, 'ready')` (Epic 9 territory; see Dev Notes "Story 9.1 bridge")
   **And** the ticket plays a 200ms slide-out animation (`animate-out fade-out slide-out-to-right duration-200` from `tailwindcss-animate`) **before** disappearing from the grid
   **And** the action requires no confirmation dialog — single tap (per UX-DR17)
   **And** during the 200ms animation the bump button is disabled (prevent double-tap firing two Server Actions); the idempotency guard `.eq('is_handled', false)` already protects the DB, but the UI state must also be locked

2. **Given** an order is bumped on the KDS
   **When** the front-of-house Admin UI is open in another tab/device
   **Then** the order disappears from the Active tab in `OrderFeed` within ≤ 5 seconds via the existing Realtime UPDATE channel (Story 5.2's `RealtimeProvider` UPDATE handler, lines 50-58)
   **And** the order appears in the Handled tab (the existing `OrderFeed` already filters by `is_handled`)
   **And** **no new Realtime subscription** is created — the bridge piggybacks on the existing channel

3. **Given** a bump action fails (network down, Server Action returns `{ success: false }`, RLS denial, etc.)
   **When** the optimistic mutation completes and the awaited `markOrderHandled` resolves with `success: false`
   **Then** the store optimistic update is **rolled back** via a new `unmarkHandled(orderId)` store action (the ticket returns to the active list)
   **And** the slide-out animation does NOT play (or is interrupted before completion — see Task 4 for state-machine sequencing)
   **And** a transient inline error appears on the ticket: `"Tap to retry — bump didn't send"` (actionable copy per project-context "user-facing error strings must be actionable") — rendered as a sibling element below the bump button in `text-error`, **NOT** as a toast (UX-DR17 explicit ban)
   **And** the bump button re-enables for retry
   **And** the inline error persists until the operator taps the bump button again — feedback is persistent until user takes action (UX-DR17)

4. **Given** kitchen staff need to undo a bump
   **When** they tap the "Undo" affordance shown at the bottom of the grid for 5 seconds after a successful bump
   **Then** the order is restored via a new `unbumpOrder(orderId)` Server Action — sets `is_handled = false, handled_at = null` (the Story 8.3 bridge for `advanceOrderStatus(orderId, 'preparing')`)
   **And** the optimistic store update fires first (ticket re-appears in its sorted position immediately), then the Server Action persists
   **And** if `unbumpOrder` returns `{ success: false }`, roll back via `markHandled(orderId)` and show an inline error on the Undo affordance — same UX-DR17 pattern (no toast)
   **And** the Realtime UPDATE re-broadcasts the `is_handled=false` change to the OrderFeed within ≤ 5s

5. **Given** 5 seconds have elapsed after a successful bump
   **When** the Undo affordance was visible
   **Then** the affordance disappears (cleared via `setTimeout(5000)` in `KdsScreen` state)
   **And** to undo later, the owner must use the Admin UI's Handled tab (out of scope for 8.3 — owner-only path)

6. **Given** the operator taps Bump twice quickly on the same ticket (double-tap)
   **When** the second tap fires during the 200ms slide-out animation
   **Then** the second tap is a UI no-op — the bump button is disabled during animation (`disabled` attribute or `pointer-events-none`)
   **And** even if a tap somehow leaks through, the Server Action's `.eq('is_handled', false)` predicate makes the second DB UPDATE a 0-row operation (no error, no `handled_at` overwrite)

7. **Given** the operator bumps Order A, then bumps Order B within Order A's 5-second Undo window
   **When** they tap Undo
   **Then** Order B (the most recent bump) is restored — the `recentlyBumped` state tracks only the latest bump
   **And** Order A remains bumped (no longer reachable via Undo from the KDS, per AC #5)
   **And** the 5-second timer resets when the second bump fires (Order B's window is fresh)

8. **Given** the Realtime UPDATE event for the bump arrives at the KDS (echo from the server)
   **When** `updateOrder(payload.new)` reconciles the store
   **Then** the store reflects `is_handled = true` (already true from the optimistic update — no visible change)
   **And** if the echo carries fields that diverge from the optimistic guess (e.g. `handled_at` from server clock vs app clock), the Realtime payload wins (the existing `state.orders.map(o => o.id === order.id ? order : o)` replacement preserves the server-side truth)

---

## Tasks / Subtasks

- [x] **Task 1 — Add `unbumpOrder` Server Action** (AC: #4)
  - [x] Edit `actions/orderActions.ts`:
    - Add a new export sibling to `markOrderHandled`:
      ```ts
      export async function unbumpOrder(orderId: string): Promise<ActionResult<void>> {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        // Idempotency guard: only unbump rows that ARE currently handled.
        // Mirrors markOrderHandled's .eq('is_handled', false) safeguard.
        const { error } = await supabase
          .from('orders')
          .update({ is_handled: false, handled_at: null })
          .eq('id', orderId)
          .eq('is_handled', true)

        if (error) {
          console.error('[unbumpOrder]', error)
          return { success: false, error: "Tap to retry — undo didn't send" }
        }
        return { success: true, data: undefined }
      }
      ```
  - [x] **DO NOT** use the admin client. Owner cookie client + RLS `owner_update_orders` is the correct path (matches `markOrderHandled` exactly).
  - [x] **DO NOT** add a `.select()` after the UPDATE — the customer-facing 42501/RETURNING rule applies to owner UPDATEs too; the established convention is no-RETURNING on RLS-gated UPDATEs.
  - [x] **Naming rationale**: `unbumpOrder` (verb+noun) over `unmarkOrderHandled` to keep KDS terminology consistent ("bump" / "undo bump"). When Story 9.1 lands, `unbumpOrder` becomes a thin alias of `advanceOrderStatus(orderId, 'preparing')`.

- [x] **Task 2 — Add `unmarkHandled` store action** (AC: #3, #4)
  - [x] Edit `stores/orderStore.ts`:
    - Add to the `OrderStore` interface: `unmarkHandled: (orderId: string) => void`
    - Implement symmetric to `markHandled` (line 38):
      ```ts
      unmarkHandled: (orderId) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, is_handled: false, handled_at: null } : o,
          ),
        })),
      ```
  - [x] **Why symmetric, not a single `setHandled(id, value)` action**: the existing `markHandled` is used by `OrderFeed.handleMarkHandled` (line 39-46 in `components/admin/OrderFeed.tsx`) and tested by `OrderFeed.test.tsx`. Introducing a new shape would force a 5.2 callsite migration. Symmetric `unmarkHandled` is additive; no existing tests break.
  - [x] **DO NOT** rename `markHandled` or change its signature.

- [x] **Task 3 — Wire bump handler in `KdsScreen` with optimistic update + rollback + Undo state + animation-aware filter** (AC: #1, #3, #4, #5, #6, #7)
  - [x] Edit `components/admin/KdsScreen.tsx`:
    - Add four component-local state slices:
      ```ts
      const [bumpingIds, setBumpingIds] = useState<Set<string>>(new Set())
      const [recentlyBumped, setRecentlyBumped] = useState<{ id: string; tableLabel: string } | null>(null)
      const [bumpError, setBumpError] = useState<{ id: string; message: string } | null>(null)
      const [undoError, setUndoError] = useState<string | null>(null)
      ```
    - **CRITICAL: extend the active-orders filter to keep mid-animation tickets visible** even after the optimistic `is_handled=true` flip:
      ```ts
      const activeOrders = orders
        .filter((o) => !o.is_handled || bumpingIds.has(o.id))
        .slice()
        .sort((a, b) => {
          const ta = Date.parse(a.submitted_at)
          const tb = Date.parse(b.submitted_at)
          if (ta !== tb) return ta - tb
          return a.id < b.id ? -1 : 1
        })
      ```
      **Why this matters**: without `|| bumpingIds.has(o.id)`, the optimistic `markHandled` call would immediately exclude the order from `activeOrders`, the `<OrderTicket>` would unmount, and the 200ms slide-out animation would never play (or play for one frame then disappear). The `bumpingIds` set is the load-bearing trick that allows optimism + animation to coexist.
    - In a `useEffect` that depends on `recentlyBumped`, set a 5_000ms timeout to clear it; cleanup the timeout on dependency change or unmount:
      ```ts
      useEffect(() => {
        if (!recentlyBumped) return
        const t = setTimeout(() => setRecentlyBumped(null), 5_000)
        return () => clearTimeout(t)
      }, [recentlyBumped])
      ```
      **Why the cleanup matters**: if the operator bumps Order A then Order B within 5s, the dependency change cancels Order A's timer and starts Order B's fresh — exactly the AC #7 behavior. Without the cleanup, both timers race and the affordance disappears at A's original deadline (UX bug).
    - Define `handleBump(orderId, tableLabel)`:
      ```ts
      async function handleBump(orderId: string, tableLabel: string) {
        // 1. Mark as "bumping" so the filter keeps the ticket visible during animation.
        setBumpingIds((prev) => {
          const next = new Set(prev)
          next.add(orderId)
          return next
        })
        // Safety net: if onAnimationEnd never fires (prefers-reduced-motion path),
        // clean up bumpingIds after 250ms anyway. The handleBumpAnimationEnd is
        // idempotent so a duplicate call from a fired onAnimationEnd is a no-op.
        setTimeout(() => handleBumpAnimationEnd(orderId), 250)
        // 2. Optimistic store update — UI flips to is_handled=true, but bumpingIds keeps it rendered.
        useOrderStore.getState().markHandled(orderId)
        // 3. Show Undo affordance immediately.
        setRecentlyBumped({ id: orderId, tableLabel })
        // 4. Clear any stale error from a previous failed bump on the SAME ticket.
        if (bumpError?.id === orderId) setBumpError(null)

        // 5. Fire the Server Action concurrently with the animation.
        const result = await markOrderHandled(orderId)
        if (!result.success) {
          // Rollback everything — the ticket bounces back.
          useOrderStore.getState().unmarkHandled(orderId)
          setBumpingIds((prev) => {
            const next = new Set(prev)
            next.delete(orderId)
            return next
          })
          setRecentlyBumped(null)
          setBumpError({ id: orderId, message: "Tap to retry — bump didn't send" })
        }
        // On success: the ticket is still in bumpingIds (mid-animation).
        // When the animation completes, OrderTicket's onAnimationEnd handler calls
        // handleBumpAnimationEnd, which removes the id from bumpingIds, and the filter
        // then excludes the order (since is_handled is now true).
      }
      ```
    - Define `handleBumpAnimationEnd(orderId)`:
      ```ts
      function handleBumpAnimationEnd(orderId: string) {
        setBumpingIds((prev) => {
          if (!prev.has(orderId)) return prev
          const next = new Set(prev)
          next.delete(orderId)
          return next
        })
      }
      ```
      **Why short-circuit if `!prev.has(orderId)`**: React 19 strict-mode double-invokes effects in dev; the `onAnimationEnd` event could fire twice or fire after rollback already removed the id. Returning `prev` unchanged avoids spurious re-renders.
    - Define `handleUndo()`:
      ```ts
      async function handleUndo() {
        if (!recentlyBumped) return
        const orderId = recentlyBumped.id
        const beforeRestore = useOrderStore.getState().orders.find((o) => o.id === orderId)

        // Optimistic restore — ticket re-appears immediately in its sorted position.
        useOrderStore.getState().unmarkHandled(orderId)
        setRecentlyBumped(null)
        setUndoError(null)

        const result = await unbumpOrder(orderId)
        if (!result.success) {
          // Roll back the restoration — re-mark handled if the row WAS handled before Undo.
          if (beforeRestore?.is_handled) useOrderStore.getState().markHandled(orderId)
          setUndoError(result.error || "Tap to retry — undo didn't send")
        }
      }
      ```
    - Pass the new props into each rendered `<OrderTicket>`:
      ```tsx
      <OrderTicket
        key={order.id}
        order={order}
        tableNumber={tablesById[order.table_id] ?? null}
        now={now}
        isBumping={bumpingIds.has(order.id)}
        onBump={handleBump}
        onBumpAnimationEnd={handleBumpAnimationEnd}
        errorMessage={bumpError?.id === order.id ? bumpError.message : null}
        onErrorDismiss={() => setBumpError(null)}
      />
      ```
    - Render the Undo affordance below the grid (only when `recentlyBumped !== null`):
      ```tsx
      {recentlyBumped && (
        <div className="fixed inset-x-0 bottom-4 z-10 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-surface-overlay p-3">
          <span className="text-sm text-text-primary">Bumped {recentlyBumped.tableLabel}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="min-h-12 rounded-md bg-accent px-4 text-sm font-semibold text-white"
            aria-label={`Undo bump for ${recentlyBumped.tableLabel}`}
          >
            Undo
          </button>
        </div>
      )}
      {undoError && (
        <p className="fixed inset-x-0 bottom-20 z-10 mx-auto max-w-md text-center text-sm text-error" role="status">
          {undoError}
        </p>
      )}
      ```
      **Positioning rationale**: `fixed bottom-4` rather than inline at end-of-grid because the grid can scroll vertically (Story 8.2 AC #4). A fixed-position affordance is always visible regardless of scroll position.
      **`min-h-12` (48px) on the Undo button**: smaller than the bump button's 64px because Undo is a secondary action and a smaller target is acceptable per WCAG 2.5.5 (24×24 minimum, 44×44 recommended). 48px clears the recommended threshold; keeping it smaller than the primary bump button preserves the visual hierarchy.
  - [x] **DO NOT** introduce a Zustand slice for `recentlyBumped` — it's screen-local UX state, not shared application state. Component-local `useState` is correct.
  - [x] **DO NOT** persist `recentlyBumped` across navigation or reloads — the 5s window is intentional and ephemeral per AC #5.

- [x] **Task 4 — Update `OrderTicket` to handle bump click, slide-out animation (parent-driven), and inline error** (AC: #1, #3, #6)
  - [x] Edit `components/admin/OrderTicket.tsx`:
    - Extend `Props` — the parent owns all bump state; OrderTicket is presentational:
      ```ts
      interface Props {
        order: Order
        tableNumber: number | null
        now: Date
        isBumping: boolean
        onBump: (orderId: string, tableLabel: string) => void
        onBumpAnimationEnd: (orderId: string) => void
        errorMessage: string | null
        onErrorDismiss: () => void
      }
      ```
    - **No local `useState` for exit state** — `isBumping` is parent-owned. This is intentional: the parent's `bumpingIds` set already tracks animation state and gates the filter (Task 3). A duplicate local flag would create state-sync bugs.
    - Replace the no-op `onClick={() => {}}` with the real handler:
      ```tsx
      <button
        type="button"
        disabled={isBumping}
        onClick={() => {
          if (errorMessage) onErrorDismiss() // clear any stale error before retrying
          onBump(order.id, tableLabel)
        }}
        aria-label={`Bump order for ${accessibleTable}`}
        className="min-h-16 w-full rounded-lg bg-accent text-base font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Bump
      </button>
      ```
      **No `async`/`await` here** — `onBump` is fire-and-forget from OrderTicket's perspective. The parent owns the await + rollback; OrderTicket just signals intent. This simplifies the click handler and avoids "is the ticket about to unmount" timing concerns.
    - Apply the slide-out animation class to the `<article>` when `isBumping`, and wire `onAnimationEnd`:
      ```tsx
      <article
        className={`rounded-lg border-2 bg-surface-raised p-4 ${borderClass} ${
          isBumping
            ? 'animate-out fade-out slide-out-to-right duration-200 fill-mode-forwards motion-reduce:animate-none'
            : ''
        }`}
        onAnimationEnd={() => {
          if (isBumping) onBumpAnimationEnd(order.id)
        }}
        aria-label={`Order for ${accessibleTable}, ${formatRelativeTime(order.submitted_at, now)}`}
      >
      ```
      - **`fill-mode-forwards`**: holds the final animated state (translated off-screen, opacity 0) until the parent removes the id from `bumpingIds`. Prevents flicker if React renders between animation-end and the state update.
      - **`motion-reduce:animate-none`**: respects `prefers-reduced-motion`. Users with reduced motion get instant removal — `onAnimationEnd` will NOT fire (no animation runs), so this path needs a fallback (see next bullet).
      - **`onAnimationEnd` fires once per animation cycle**. The `if (isBumping)` guard prevents a spurious second call (e.g. if the `animate-pulse` on the elapsed-time span coincidentally completes a cycle while `isBumping=true` — `onAnimationEnd` bubbles).
    - **`prefers-reduced-motion` fallback** — when motion is reduced, `onAnimationEnd` never fires (no animation = no end event). Add a parallel cleanup in the parent via `setTimeout(0)` so the bumpingIds set still clears:
      - Decision: handle this in the PARENT (`handleBump` in Task 3), NOT in the OrderTicket. After firing the optimistic update, schedule a `setTimeout(() => handleBumpAnimationEnd(orderId), 250)` as a safety net. If `onAnimationEnd` fires first, the second cleanup is a no-op (guarded by `!prev.has(orderId)`). 250ms is the 200ms animation + 50ms margin.
      - **Update Task 3** to add this safety net inside `handleBump` immediately after `setBumpingIds(...)`:
        ```ts
        setTimeout(() => handleBumpAnimationEnd(orderId), 250)
        ```
        **Why 250ms not 200ms**: gives the natural `onAnimationEnd` event time to fire first under normal motion settings. Under `prefers-reduced-motion`, the timeout is the only path; 50ms slack is invisible.
    - Render the inline error below the bump button when `errorMessage` is set:
      ```tsx
      {errorMessage && (
        <p
          className="mt-2 text-sm text-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      ```
      **`role="alert"`**: screen readers announce on appearance (per WAI-ARIA Alert role). Sighted users see the message inline; the next bump tap clears it via `onErrorDismiss`.
  - [x] **DO NOT** add `useState` for a local `isExiting` flag — parent owns animation state via `bumpingIds`.
  - [x] **DO NOT** add `async`/`await` inside the click handler — fire-and-forget; parent awaits.
  - [x] **DO NOT** add a confirmation dialog before bump — single tap (AC #1, reinforces UX-DR17).
  - [x] **DO NOT** import `unbumpOrder` in `OrderTicket` — the undo handler lives at the screen level (parent owns Undo state).

- [x] **Task 5 — Unit tests for `OrderTicket` bump click, animation, and error** (AC: #1, #3, #6)
  - [x] Update `tests/unit/admin/OrderTicket.test.tsx`:
    - `OrderTicket` doesn't import the Server Action directly (parent passes `onBump`), so no `vi.mock` is needed. Pass stubs in each test.
    - **Update existing render calls** to pass the new props: `isBumping={false}`, `onBump={vi.fn()}`, `onBumpAnimationEnd={vi.fn()}`, `errorMessage={null}`, `onErrorDismiss={vi.fn()}`. All 15 existing tests should pass after adding these props.
    - **New tests**:
      - `'bump click calls onBump with order.id and table label'`: render with `onBump = vi.fn()`, `tableNumber=7`. `fireEvent.click(screen.getByRole('button', { name: /bump/i }))`. Assert `onBump` called with `(order.id, 'Table 7')`.
      - `'bump click calls onBump with table label "Table —" when tableNumber is null'`: render with `tableNumber=null`. Click. Assert `onBump` called with `(order.id, 'Table —')` — confirms the table label passes through to the Undo affordance for unknown tables.
      - `'bump button is disabled when isBumping is true'`: render with `isBumping={true}`. Assert `screen.getByRole('button', { name: /bump/i }).disabled === true`. Click should NOT call `onBump` (React respects the `disabled` attribute on `<button>`).
      - `'article gets animate-out and slide-out-to-right classes when isBumping is true'`: render with `isBumping={true}`. Read `container.querySelector('article')?.className`; assert it includes `animate-out` and `slide-out-to-right` and `duration-200` and `fill-mode-forwards` and `motion-reduce:animate-none`.
      - `'article does NOT have animate-out classes when isBumping is false'`: render with `isBumping={false}`. Assert the article className does NOT include `animate-out`.
      - `'onAnimationEnd fires onBumpAnimationEnd when isBumping is true'`: render with `isBumping={true}`, `onBumpAnimationEnd = vi.fn()`. `fireEvent.animationEnd(container.querySelector('article')!)`. Assert `onBumpAnimationEnd` called with `order.id`.
      - `'onAnimationEnd does NOT fire onBumpAnimationEnd when isBumping is false'`: render with `isBumping={false}`. Fire animationEnd. Assert NOT called — guards against spurious calls from coincidental `animate-pulse` cycles on the elapsed-time span.
      - `'inline error renders when errorMessage prop is set'`: pass `errorMessage="Tap to retry — bump didn't send"`. Assert the text is in the document. Assert the error element has `role="alert"` (via `screen.getByRole('alert')`).
      - `'no error renders when errorMessage prop is null'`: pass `errorMessage={null}`. Assert `screen.queryByRole('alert')` is null.
      - `'clicking bump after an error calls onErrorDismiss before onBump'`: pass `errorMessage="..."` and `onErrorDismiss = vi.fn()`. Click bump. Assert `onErrorDismiss` was called once.
      - `'clicking bump without an error does NOT call onErrorDismiss'`: pass `errorMessage={null}` and `onErrorDismiss = vi.fn()`. Click bump. Assert `onErrorDismiss` was NOT called — avoid unnecessary parent re-renders.
    - Vitest harness reminders (per Story 7.2 + 8.2 reviews): no `jest-dom`; plain `.textContent.includes()` / `className.includes()` / `.getAttribute()` / `.toBeTruthy()` / `.disabled` boolean / `screen.queryByRole(...)` is null. `afterEach(cleanup)` at the top.
    - **DO NOT** test `prefers-reduced-motion` behavior in unit tests — jsdom doesn't simulate it reliably. Manual verification (Task 8) covers it.

- [x] **Task 6 — Unit tests for `KdsScreen` bump and undo orchestration** (AC: #2, #3, #4, #5, #7)
  - [x] Update `tests/unit/admin/KdsScreen.test.tsx`:
    - Add a `vi.mock` for `@/actions/orderActions`:
      ```ts
      const markOrderHandledMock = vi.fn()
      const unbumpOrderMock = vi.fn()
      vi.mock('@/actions/orderActions', () => ({
        markOrderHandled: (...args: unknown[]) => markOrderHandledMock(...args),
        unbumpOrder: (...args: unknown[]) => unbumpOrderMock(...args),
      }))
      ```
      Reset both in `beforeEach`.
    - **Important context for these tests**: the bump flow involves a `bumpingIds` set + `onAnimationEnd`. In jsdom there's no real animation, so `onAnimationEnd` won't fire naturally. Two reliable strategies:
      1. **Fire `animationEnd` manually**: `fireEvent.animationEnd(container.querySelector('article')!)` to simulate the event.
      2. **Use the parent's 250ms safety-net `setTimeout`** under `vi.useFakeTimers()`: `vi.advanceTimersByTime(250)` clears `bumpingIds` automatically.
       Choose strategy 2 by default — it's how the production code self-recovers and exercises the same code path the safety net covers.
    - **New tests**:
      - `'bumping a ticket calls markOrderHandled, flips is_handled, and shows Undo affordance'`:
        - `markOrderHandledMock.mockResolvedValueOnce({ success: true, data: undefined })`.
        - Mock store with 1 active order; render KdsScreen with that order's `table_id` mapped to `Table 5` via `tablesById`.
        - `fireEvent.click(screen.getByRole('button', { name: /bump/i }))`.
        - Wait for the action to resolve via `await act(async () => { await Promise.resolve() })` or `await screen.findByRole('button', { name: /undo/i })`.
        - Assert `markOrderHandledMock` called with the order id.
        - Assert the Undo affordance is visible (`screen.getByRole('button', { name: /undo/i })`).
        - Assert `useOrderStore.getState().orders[0].is_handled === true` (mocked store, so use the mock's recorded state — or query the rendered store via the selector mock).
      - `'ticket stays rendered during animation (bumpingIds keeps it in active filter)'`:
        - Setup: 1 order, bump succeeds.
        - Click bump. BEFORE advancing timers / firing animationEnd, assert the article is still in the document (`container.querySelector('article')`) — because `bumpingIds.has(orderId)` keeps it past the optimistic `is_handled=true` flip.
        - Advance timers 250ms (or fire animationEnd manually).
        - Assert the article is gone.
      - `'bump rollback: failed Server Action restores the order and shows inline error'`:
        - `markOrderHandledMock.mockResolvedValueOnce({ success: false, error: 'Network unavailable' })`.
        - Click bump. Await the rejection.
        - Assert the ticket is back (still rendered, still in active filter).
        - Assert no Undo affordance shown (`screen.queryByRole('button', { name: /undo/i })` is null).
        - Assert the OrderTicket's inline error renders (`screen.getByRole('alert').textContent.includes('bump didn\'t send')`).
        - **Note**: the error appears via the `errorMessage` prop the parent passes down. The mocked store must reflect the rollback (the parent calls `useOrderStore.getState().unmarkHandled(orderId)`); ensure the store mock supports this.
      - `'tap Undo restores the bumped order and calls unbumpOrder'`:
        - `markOrderHandledMock` returns success, `unbumpOrderMock` returns success.
        - Click bump → await Undo affordance → click Undo.
        - Assert `unbumpOrderMock` called with the order id.
        - Assert the ticket re-renders (`screen.getByRole('article')` exists again).
        - Assert the Undo affordance is gone.
      - `'Undo rollback: failed unbumpOrder re-marks handled and shows undo error'`:
        - Bump succeeds; `unbumpOrderMock.mockResolvedValueOnce({ success: false, error: "Tap to retry — undo didn't send" })`.
        - Click bump → click Undo → await.
        - Assert the order is back to `is_handled = true` in store (Undo rolled back).
        - Assert the undo error text appears (look for `Tap to retry`).
      - `'Undo affordance disappears after 5 seconds'`:
        - `vi.useFakeTimers()`. Bump (success). Assert affordance visible.
        - `await act(() => { vi.advanceTimersByTime(5_001) })`.
        - Assert `screen.queryByRole('button', { name: /undo/i })` is null.
      - `'consecutive bumps track only the most recent for Undo'` (AC #7):
        - Two orders A (Table 1) and B (Table 2) in store. Bump A → bump B (both within 5s).
        - Each bump returns success; the 250ms safety-net fires for each.
        - Assert the Undo affordance shows Table 2 (not Table 1): `screen.getByText(/Table 2/).closest('button')` or check the affordance text.
        - Click Undo → assert `unbumpOrderMock` called with B's id (the most recent bump).
        - Order A remains bumped (no longer reachable via Undo).
      - `'consecutive bumps reset the 5s timer'` (AC #7 reinforce):
        - `vi.useFakeTimers()`. Bump A → advance 3_000ms → bump B → advance 3_000ms (total 6s since A, but only 3s since B).
        - Assert affordance is STILL visible after 6s total (B's timer is fresh).
        - Advance another 2_001ms → assert affordance gone.
      - **Update existing wake-lock tests** — they pass `tablesById={{}}` and no other props; KdsScreen still doesn't take new props from outside (all new state is internal). Existing tests pass unchanged.
    - **Update existing sort and tick tests** if any rendering assertions break due to the new `Undo` affordance fixed-positioned element appearing — most likely none break since these tests don't trigger bumps.
  - [x] **DO NOT** test the slide-out animation class on OrderTicket here — that's covered in `OrderTicket.test.tsx`. KDS-level tests verify orchestration only (Server Action calls, store state, affordance visibility, timer behavior).

- [x] **Task 7 — Extend E2E spec for bump flow** (AC: #1, #2)
  - [x] Edit `tests/e2e/admin-kds.spec.ts`:
    - Add a new test after the "tickets visible" test:
      ```ts
      test('bumping an order removes it from KDS and marks is_handled=true', async ({ page }) => {
        const tableId = await createTestTable(svc, restaurantId, 42)
        const items = [{ name: 'Burger', quantity: 1, variants: [], unit_price_cents: 1500 }]
        const orderId = await createTestOrder(svc, restaurantId, tableId, items)

        await signIn(page)
        await page.goto('/admin/kds')

        const ticket = page.locator('article', { hasText: 'Table 42' })
        await expect(ticket).toBeVisible()

        await ticket.getByRole('button', { name: /bump/i }).click()

        // Ticket should disappear within a few seconds (animation + store update + filter)
        await expect(ticket).toBeHidden({ timeout: 2000 })

        // Undo affordance should appear
        await expect(page.getByRole('button', { name: /undo/i })).toBeVisible()

        // Verify DB state
        const { data: order } = await svc
          .from('orders')
          .select('is_handled, handled_at')
          .eq('id', orderId)
          .single()
        expect(order?.is_handled).toBe(true)
        expect(order?.handled_at).not.toBeNull()
      })

      test('Undo restores a bumped order on KDS', async ({ page }) => {
        const tableId = await createTestTable(svc, restaurantId, 43)
        const items = [{ name: 'Fries', quantity: 1, variants: [], unit_price_cents: 500 }]
        const orderId = await createTestOrder(svc, restaurantId, tableId, items)

        await signIn(page)
        await page.goto('/admin/kds')

        await page.locator('article', { hasText: 'Table 43' }).getByRole('button', { name: /bump/i }).click()
        await expect(page.getByRole('button', { name: /undo/i })).toBeVisible()

        await page.getByRole('button', { name: /undo/i }).click()

        // Ticket should reappear
        await expect(page.locator('article', { hasText: 'Table 43' })).toBeVisible({ timeout: 2000 })

        // Verify DB state
        const { data: order } = await svc
          .from('orders')
          .select('is_handled, handled_at')
          .eq('id', orderId)
          .single()
        expect(order?.is_handled).toBe(false)
        expect(order?.handled_at).toBeNull()
      })
      ```
    - **Reuse** the existing `beforeAll` / `afterAll` fixtures (restaurant + owner already created). The `cleanupTestRestaurants` helper deletes orders and tables by `restaurant_id` cascade, so no per-test cleanup needed.
    - **DO NOT** add a separate RLS test — no new RLS surface in 8.3 (uses the existing `owner_update_orders` policy).
    - **DO NOT** assert specific border colors or animation classes in E2E — Playwright CSS-string assertions are fragile and the unit tests cover this already.

- [ ] **Task 8 — Manual + visual verification**
  - [ ] Start `npm run dev`, sign in as test owner, visit `/admin/kds`.
  - [ ] Place an order via the customer flow. Confirm the ticket appears on the KDS.
  - [ ] Tap the Bump button. Confirm:
    - The ticket plays a ~200ms slide-out animation (visible motion).
    - The ticket disappears from the grid.
    - The "Undo Bumped Table N" affordance appears at the bottom.
  - [ ] Open `/admin/orders` in another tab. Confirm the bumped order has moved to the Handled tab within ~5s.
  - [ ] Tap Undo within 5s. Confirm the ticket reappears on the KDS and reverts to Active in the OrderFeed.
  - [ ] Wait 5s after a bump. Confirm the Undo affordance disappears.
  - [ ] Toggle network off in DevTools → bump a ticket. Confirm the inline error "Tap to retry — bump didn't send" appears below the bump button and the ticket stays on the grid.
  - [ ] Toggle network back on, tap bump again. Confirm the bump succeeds and the error clears.
  - [ ] Test with `prefers-reduced-motion: reduce` (Chrome DevTools → Rendering → Emulate CSS media feature): confirm the bump still works but skips the slide-out animation.
  - [ ] Bump two orders within 5s. Confirm only the most recent Undo affordance is visible; tapping Undo restores the second order (AC #7).
  - [ ] On the iPad Mini viewport (768×1024), confirm the Undo affordance is centered and not overlapping with any ticket grid content.
  - [ ] (Left for manual verification by user)

### Review Findings

_Code review run on 2026-05-20 (Blind Hunter + Edge Case Hunter + Acceptance Auditor)._

- [x] [Review][Patch] Safety-net 250ms `setTimeout` leaks on unmount + stale safety-net races consecutive re-bump of same id [components/admin/KdsScreen.tsx:62] — track timer per orderId (or in a ref array), `clearTimeout` previous before scheduling, clean up on unmount
- [x] [Review][Patch] Re-entrant `handleBump`: double-tap before React applies `disabled` prop runs the handler twice [components/admin/KdsScreen.tsx:55] — guard with `if (bumpingIds.has(orderId)) return` at top of handleBump
- [x] [Review][Patch] `bumpError` dismiss callback can clear another ticket's error [components/admin/KdsScreen.tsx:162] — use functional setState with id check: `setBumpError(cur => cur?.id === order.id ? null : cur)`
- [x] [Review][Patch] `undoError` persists indefinitely with no auto-dismiss [components/admin/KdsScreen.tsx:180] — add a useEffect that clears after 5s, mirroring the recentlyBumped timer
- [x] [Review][Patch] `OrderTicket` `onAnimationEnd` doesn't check `e.target === e.currentTarget` — child `animate-pulse` on the time span could bubble [components/admin/OrderTicket.tsx:199] — add `e.target === e.currentTarget` guard
- [x] [Review][Patch] Failed bump rollback unconditionally clears `recentlyBumped`, wiping a successful Undo banner from a different ticket bumped concurrently [components/admin/KdsScreen.tsx:108] — only clear if `recentlyBumped?.id === orderId`
- [x] [Review][Patch] Failed bump rollback fires even after a successful Undo of the same id raced ahead — overwrites Undo's restored state [components/admin/KdsScreen.tsx:106] — re-check current store state before rollback (or skip rollback when recentlyBumped is no longer this id)
- [x] [Review][Patch] Double-tap Undo before first await resolves can fire `unbumpOrder` twice [components/admin/KdsScreen.tsx:80] — guard with an `undoInFlight` flag
- [x] [Review][Patch] Undo banner can overlap the last remaining ticket on narrow viewports, blocking its Bump button [components/admin/KdsScreen.tsx:148] — add `pb-24` (or similar) bottom padding to the grid so the fixed banner doesn't cover content
- [x] [Review][Patch] Shared `defaultProps.onBump` `vi.fn()` is module-scoped and never reset between tests; "does NOT call" assertions silently accept calls accumulated from earlier tests [tests/unit/admin/OrderTicket.test.tsx:33] — move mocks into `beforeEach` or call `mockClear()` in `afterEach`
- [x] [Review][Patch] E2E Undo button selector lacks table-specific aria-label assertion — passes for any Undo banner [tests/e2e/admin-kds.spec.ts:97, 114] — use `getByRole('button', { name: /undo bump for table 42/i })`
- [x] [Review][Patch] E2E race: DB state is asserted right after `toBeHidden`, but the Server Action may still be in flight [tests/e2e/admin-kds.spec.ts:99-105] — poll the DB row with `expect.poll(...)` until `is_handled === true`, or explicitly wait for a network-idle signal
- [x] [Review][Patch] Unit test "ticket stays rendered during animation" makes no real assertion after advancing timers [tests/unit/admin/KdsScreen.test.tsx:486] — make `markHandledMock` flip `is_handled=true` in `storeOrders`, then assert article is gone after `vi.advanceTimersByTime(250)`
- [x] [Review][Patch] Unit test "Undo rollback" has an awkward mid-test `cleanup()` + re-render after stacking two scenarios [tests/unit/admin/KdsScreen.test.tsx:549] — refactor to a single linear setup with an unhanded order



### Critical Context — Story 9.1 Bridge

**Story 9.1 (status enum) is still in backlog.** The epic-level AC text for 8.3 references `advanceOrderStatus(orderId, 'ready')` and `advanceOrderStatus(orderId, 'preparing')` — but **the `status` enum column does not exist yet**. Story 9.1 introduces it.

**Story 8.3 ships with a bridge implementation** that mirrors the pattern from Stories 8.1 and 8.2:

| Epic 8.3 reference | Story 8.3 bridge (no 9.1) | Future swap (when 9.1 lands) |
|---|---|---|
| `advanceOrderStatus(orderId, 'ready')` | `markOrderHandled(orderId)` (existing from 5.2) | Replace the call site |
| `advanceOrderStatus(orderId, 'preparing')` for Undo | `unbumpOrder(orderId)` (NEW in this story) | Replace the call site |
| Active filter `status IN ('received', 'preparing')` | `!o.is_handled` (existing, from 8.1/8.2) | Story 9.2 migrates the filter |
| Realtime cross-surface broadcast | Already works via existing UPDATE handler (5.2) | Unchanged |

**When Story 9.1 lands**, a small follow-up will swap `markOrderHandled` → `advanceOrderStatus(id, 'ready')` and `unbumpOrder` → `advanceOrderStatus(id, 'preparing')` at the KDS call sites only. The bridge does NOT block 9.1; in fact it accelerates it by separating the KDS UX work from the schema work.

**DO NOT** add a `status` column, enum type, or `advanceOrderStatus` function in this story. Those belong in Story 9.1's migration. **DO NOT** wait for 9.1 — it's an out-of-sequence dependency.

### Optimistic Update + Rollback Pattern

Story 5.2's `OrderFeed.handleMarkHandled` did optimistic update but **did NOT roll back on failure** — a known gap (per the code-review patches applied to 5.2). Story 8.3's AC #3 explicitly upgrades the pattern: rollback IS required.

The rollback contract:
1. Optimistically mutate the store via `markHandled(orderId)`.
2. `await markOrderHandled(orderId)`.
3. If `result.success === false`:
   - Roll back via the new `unmarkHandled(orderId)` store action (Task 2).
   - Clear `recentlyBumped` (no Undo affordance for a failed bump).
   - Set `bumpError` so the OrderTicket renders the inline error.
4. The Realtime UPDATE that would normally reconcile `handled_at` from the server never arrives (the DB write failed), so step 3 is the complete recovery path.

**Why optimistic, not pessimistic** (server-first):
- Per project-context "user-facing error strings must be actionable" + UX-DR17 "calm by design": a spinner during the network round-trip would create anxiety on every tap. Optimistic UI feels instant; only the rare failure shows feedback.
- The Realtime UPDATE channel (Story 5.2) is the source of truth for cross-surface consistency — optimistic local state is OK because the server eventually reconciles via `updateOrder`.

### Animation Pattern — tailwindcss-animate

The project has `tailwindcss-animate ^1.0.7` registered in `tailwind.config.ts:83` and **no other animation library** (no framer-motion, no Motion One). All Story 8.3 animations must use this plugin.

Available utilities (verified):
- `animate-in`, `animate-out` — base entrance/exit toggles
- `fade-in`, `fade-out` — opacity transition
- `slide-in-from-{top,bottom,left,right}`, `slide-out-to-{top,bottom,left,right}` — translate transition
- `duration-{n}` — animation duration (use `duration-200` for AC #1's 200ms)
- `fill-mode-forwards` — holds final keyframe state after animation completes

**The 200ms slide-out class string** for the bumped ticket:
```
animate-out fade-out slide-out-to-right duration-200 fill-mode-forwards
```

**`prefers-reduced-motion`**: `tailwindcss-animate` honors it for `animate-pulse` (already in use). For `animate-out`, add `motion-reduce:animate-none` explicitly so users with reduced-motion preferences get instant removal without the slide.

**Why right-direction slide-out**: matches the natural "swipe off the queue" mental model. Tickets enter from the realtime feed (top-down by sort), exit horizontally. Vertical slide-out would compete with the grid layout's natural row flow.

### UX-DR17 Compliance (Calm By Design / No Toast)

UX-DR17 is restated three times in the planning docs:
1. `epics.md:138` — original Design Direction definition
2. `ux-design-specification.md:824` — "New OrderCard appearing is the signal. Calm by design."
3. `ux-design-specification.md:860` — "Toast notifications are banned. Easy to miss, create anxiety."

For Story 8.3, this means:
- **Bump success**: no toast, no banner, no "Bumped!" confirmation — the slide-out animation IS the feedback. The Undo affordance appearing IS the secondary signal.
- **Bump failure**: inline error on the ticket itself (`role="alert"` for screen readers, `text-error` for sighted), NOT a toast. The error persists until the operator taps bump again (clears via `onErrorDismiss`).
- **Undo success**: no confirmation — the ticket re-appearing on the grid is the signal.
- **Undo failure**: inline error next to the Undo affordance, NOT a toast.

**DO NOT** import any toast library (none is installed; the project doesn't have `react-hot-toast`, `sonner`, `react-toastify`, etc.). **DO NOT** invent a notification banner above the ticket grid — keep all feedback at the source (the ticket itself, or the Undo affordance).

### Idempotency Guards

Both Server Actions use an `is_handled` predicate as an idempotency guard:
- `markOrderHandled`: `.eq('is_handled', false)` — a re-tap on an already-handled order is a 0-row UPDATE, no error, no `handled_at` overwrite.
- `unbumpOrder` (NEW): `.eq('is_handled', true)` — a re-tap on an already-unbumped order is a 0-row UPDATE.

This protects against:
- Double-tap during the 200ms slide-out (already disabled in UI per Task 4, but defense-in-depth).
- Two operators on two tablets bumping the same ticket simultaneously (race).
- The Undo button being tapped twice within the 5s window (defense; the `setRecentlyBumped(null)` after first tap should prevent this anyway).

**DO NOT** remove or change these `.eq(...)` predicates. They are load-bearing for correctness.

### Cross-Surface Realtime Behavior

Story 5.2 added the `event: 'UPDATE'` handler to `RealtimeProvider` (`components/shared/RealtimeProvider.tsx`, around line 50). When `markOrderHandled` writes to the DB:
1. Supabase Realtime broadcasts the UPDATE event to all subscribed clients.
2. Both the KDS tablet (subscribed via the global `RealtimeProvider`) and the front-of-house Admin UI (same subscription) receive the event.
3. Each client's `updateOrder(payload.new)` reconciles the store.
4. The KDS filter (`!is_handled`) removes the ticket; the OrderFeed Active tab filter does the same; the Handled tab now shows it.

**No new subscription is needed**. The single global channel handles both surfaces. **DO NOT** add a KDS-specific Realtime channel.

**Echo timing**: the optimistic update fires first (instant UI feedback). The Realtime echo arrives ~100-500ms later in normal conditions. The `updateOrder` reconciliation is idempotent (the order's `is_handled` is already `true`), so the echo is a no-op from the user's perspective — but it DOES update fields like `handled_at` from server-clock truth (the optimistic version uses app-clock `new Date().toISOString()`).

### Architecture Compliance

**Routing**: No new routes. `/admin/kds` from Story 8.1 is extended.

**Client selection** (`docs/conventions/supabase-clients.md`):
- `unbumpOrder` Server Action uses the **server cookie client** (`lib/supabase/server.ts` → `createClient`) — owner JWT, gated by RLS `owner_update_orders`. Mirrors `markOrderHandled`.
- **NOT** the admin client. Bumps are owner-authenticated actions; admin client would bypass the audit trail and tenant boundary.

**Server Action discipline**:
- `'use server'` directive at the top of `actions/orderActions.ts` is already present.
- Return type `Promise<ActionResult<void>>` for both `markOrderHandled` (existing) and `unbumpOrder` (new).
- Never throws — always returns `ActionResult`.
- No `.select()` after UPDATE (same 42501/RETURNING-or-RLS rule that applies to customer INSERTs applies to all RLS-gated UPDATEs).

**Realtime**: No changes to `RealtimeProvider.tsx`. UPDATE handler from 5.2 is sufficient.

**Naming compliance**:
- Server Actions: `unbumpOrder` — verb + noun, camelCase. ✓
- Store actions: `unmarkHandled` — matches existing `markHandled` symmetry. ✓
- Local handlers in component: `handleBump`, `handleUndo` — `handle` prefix. ✓
- Component-local state: `recentlyBumped`, `bumpError`, `undoError`, `isExiting` — camelCase. ✓

**Schema changes**: None in 8.3. The `status` enum migration is Story 9.1's territory.

**RLS**: No changes; uses existing `owner_update_orders` policy. The new `unbumpOrder` action writes to the same column (`is_handled`) the policy already gates.

**Styling rules** (project-context):
- Tailwind only.
- Design tokens only: `bg-surface-base`, `bg-surface-raised`, `bg-surface-overlay`, `bg-accent`, `text-text-primary`, `text-text-secondary`, `text-error`, `border-border`, `border-warning` (added 8.2), `border-error`.
- Breakpoints: `sm` and `lg` only.
- `min-h-16` (64px) for the bump button (already from 8.2).
- `min-h-12` (48px) for the Undo button — secondary action; clears WCAG 2.5.5 recommended 44px.

**Anti-patterns to avoid**:
- Do **not** add a confirmation dialog before bump.
- Do **not** use a toast for any feedback.
- Do **not** add framer-motion or any animation library.
- Do **not** mutate the `useOrderStore.orders` array in place (the existing actions use immutable `map`/`spread` patterns; keep that).
- Do **not** add a `status` column or `advanceOrderStatus` Server Action — Story 9.1 owns this.
- Do **not** add a spinner during the in-flight bump (UX-DR17 + the optimistic pattern).
- Do **not** create a new Realtime channel; the global subscription covers cross-surface broadcast.
- Do **not** use the admin client for `unbumpOrder`. Owner cookie client + RLS.
- Do **not** add `.select()` after the `unbumpOrder` UPDATE — same rule as `markOrderHandled`.
- Do **not** export `unmarkHandled` in tests by mocking partial store state — use the actual store. Story 5.2's tests mock the store via `vi.mock('@/stores/orderStore', ...)`; mirror that exact pattern.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`actions/orderActions.ts`** (current state, post-Story 5.2):
- Has `submitOrder` (admin client, customer flow) and `markOrderHandled` (server cookie client, owner flow).
- Server Actions file pattern: `'use server'` directive, no individual function directives.
- Add `unbumpOrder` as a new export. Do NOT split into a new file — keep it grouped with `markOrderHandled`.

**`stores/orderStore.ts`** (current state):
- Zustand store with `orders`, `isRealtimeReady`, `addOrder`, `updateOrder`, `markHandled` actions.
- `markHandled` uses immutable `.map()` — mirror this for `unmarkHandled`.
- `sortDesc` is the default sort. The KDS-local sort in 8.2 is ASC and lives in `KdsScreen`; do NOT modify `sortDesc`.

**`components/admin/KdsScreen.tsx`** (current state, post-8.2 review patches):
- `tablesById` prop, sort uses `Date.parse(...)`, 30s tick via `setInterval`, wake-lock effect.
- Renders `<OrderTicket order={order} tableNumber={...} now={now} />` — Story 8.3 ADDS `onBump`, `errorMessage`, `onErrorDismiss` props.
- **DO NOT** modify the wake-lock effect, the sort, or the tick. Story 8.3 ADDS state (`recentlyBumped`, `bumpError`, `undoError`) but does NOT replace any existing state.

**`components/admin/OrderTicket.tsx`** (current state, post-8.2 review patches):
- Computes `elapsedMinutes` with `Math.max(0, ...)`, border class via threshold ternary, `accessibleTable` aria-label fallback.
- The bump button currently has `onClick={() => {}}` — Story 8.3 replaces this with the real handler.
- **DO NOT** modify the elapsed-time logic, the table label, or the article aria-label.

**`components/admin/OrderFeed.tsx`** — reference for the optimistic + Server Action pattern. Story 8.3's `handleBump` mirrors `OrderFeed.handleMarkHandled` but adds rollback:
- 5.2 pattern (current): optimistic mutation → await action → log error only on failure.
- 8.3 pattern (new): optimistic mutation → await action → **rollback + inline error** on failure.

**`components/shared/RealtimeProvider.tsx`** — read-only reference; the UPDATE handler is already wired. Story 8.3 does NOT modify.

**`tests/unit/admin/OrderFeed.test.tsx`** — reference for the `vi.mock('@/actions/orderActions', ...)` pattern. Mirror this in `KdsScreen.test.tsx` updates.

**`types/app.ts`** — `Order` type has `is_handled: boolean` and `handled_at: string | null`. Both are mutable via Server Action + Realtime UPDATE. No type changes needed for 8.3.

**`types/supabase.ts`** — `orders` row shape matches `Order`. No schema in 8.3.

**`tailwind.config.ts`** — `plugins: [require("tailwindcss-animate")]` is registered. `animate-out`/`slide-out-to-right`/`duration-200`/`fill-mode-forwards` utilities are all available without further config.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `actions/orderActions.ts` | UPDATE | Add `unbumpOrder` Server Action (mirrors `markOrderHandled` with inverted flags) |
| `stores/orderStore.ts` | UPDATE | Add `unmarkHandled(orderId)` action (symmetric to `markHandled`) |
| `components/admin/KdsScreen.tsx` | UPDATE | Add `recentlyBumped`, `bumpError`, `undoError` state; `handleBump` + `handleUndo` orchestration; Undo affordance render |
| `components/admin/OrderTicket.tsx` | UPDATE | Add `onBump`, `errorMessage`, `onErrorDismiss` props; wire bump click with slide-out animation + inline error |
| `tests/unit/admin/OrderTicket.test.tsx` | UPDATE | Add bump-click tests, error-render tests, disable-during-flight test, animation-class assertion |
| `tests/unit/admin/KdsScreen.test.tsx` | UPDATE | Mock `markOrderHandled` + `unbumpOrder`; add bump optimistic, rollback, Undo, 5s timer, recent-only tests |
| `tests/e2e/admin-kds.spec.ts` | UPDATE | Add two tests: bump removes ticket + DB state, Undo restores ticket + DB state |

**No changes to:**
- `types/app.ts` — `Order` already covers everything.
- `types/supabase.ts` — no schema change.
- `components/shared/RealtimeProvider.tsx` — UPDATE handler from 5.2 is sufficient.
- `components/admin/OrderFeed.tsx` — 5.2 patterns unchanged.
- `components/admin/OrderCard.tsx` — 5.2 patterns unchanged.
- `app/admin/kds/page.tsx` — no SSR data changes (tables lookup from 8.2 is sufficient).
- `app/admin/kds/loading.tsx` — skeleton from 8.2 is unchanged.
- `tailwind.config.ts` / `app/globals.css` — no new tokens; `tailwindcss-animate` already registered.
- `tests/rls/helpers.ts` — `createTestTable` + `createTestOrder` from 8.2 are sufficient.
- Any SQL migration — no schema changes.

### Testing Standards

**Three test layers** (project-context rule):

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/` | Vitest (`npm run test`) | `OrderTicket` (bump click, error), `KdsScreen` (orchestration, Undo timer) |
| RLS integration | n/a | — | **Not used** — no new DB access patterns; existing `owner_update_orders` policy covers `unbumpOrder` |
| E2E | `tests/e2e/admin-kds.spec.ts` | Playwright (`npm run test:e2e`) | Bump removes ticket + verifies DB; Undo restores ticket + verifies DB |

**Vitest harness reminders** (per Story 7.2 debug-log; reinforced by 8.1 + 8.2 reviews):
- No `@testing-library/jest-dom` — use `.toBeTruthy()`, `.getAttribute()`, `.textContent.includes(...)`, `className.includes(...)`, `.disabled` boolean.
- `afterEach(cleanup)` at the top of every component test file.
- `vi.useFakeTimers()` for the 5s Undo timer test; restore via `vi.useRealTimers()` in `afterEach`.
- Wrap timer advances in `act(() => ...)`.
- Mock the Server Action module: `vi.mock('@/actions/orderActions', () => ({ markOrderHandled: ..., unbumpOrder: ... }))`. Reset mocks in `beforeEach`.
- Mock the store via `vi.mock('@/stores/orderStore', ...)` exactly as Story 8.2's `KdsScreen.test.tsx` does — the test file already has this pattern. Add `unmarkHandled` to the mock if your assertions touch it.

**Mocking discipline**:
- Unit tests MUST NOT hit a real DB. Mock the Server Actions.
- The real `markOrderHandled` and `unbumpOrder` are only exercised in E2E.
- This matches the project-context rule: "RLS tests are P0" / "must hit a real DB" applies to integration + E2E only.

**E2E rule** (project-context + Epic 4 retro):
- Seed orders via the service-role client (`getServiceClient` + `createTestOrder` from `tests/rls/helpers.ts`).
- Do **not** mock Supabase in E2E — must hit local Supabase.
- Verify DB state after the action (assert `is_handled` flag in the DB, not just UI removal). This is the "real-DB smoke test required" rule from memory.

**Sort test discipline** (post-8.2 review lesson):
- For sort assertions, use distinct, recognizable values (e.g. distinct `Table N` numbers via `tablesById`) so the rendered DOM order can be asserted; do NOT assert only `length === 3`. The KDS sort test was mutation-tested in 8.2 — preserve that quality bar.

### Previous Story Intelligence

**From Story 8.2 (Order Tickets, Sequence & Priority Signals) — code review findings applied 2026-05-20:**
- The sort test in `KdsScreen.test.tsx` now uses distinct `tablesById` and asserts the rendered `Table N` sequence. Mutation-tested by inverting the comparator: fails correctly. **DO NOT** regress this.
- `OrderTicket` aria-label uses `accessibleTable = "unknown table"` when `tableNumber === null`; visible text uses `"Table —"`. Preserve this dual-label pattern.
- The bump button has `onClick={() => {}}` no-op. Story 8.3 replaces this with the real handler — that's the ENTIRE point of 8.3.
- `markHandled` store action exists; `unmarkHandled` is NEW in 8.3.
- The 30s tick interval lives in `KdsScreen`; per-ticket intervals are forbidden. Story 8.3 ADDS the 5s Undo timer as a separate effect — that's fine, it's a one-shot setTimeout, not a recurring interval.

**From Story 5.2 (Order Management — Mark Handled & Session History):**
- `markOrderHandled` Server Action: server cookie client, `.eq('is_handled', false)` idempotency guard, no `.select()`.
- `OrderFeed.handleMarkHandled`: optimistic + await Server Action; **no rollback on failure** (5.2 gap).
- Story 8.3 explicitly upgrades this pattern with rollback.

**From Story 5.1 (Real-Time Order Feed):**
- Global `RealtimeProvider` subscribes to INSERT + UPDATE events. `useOrderStore.updateOrder` reconciles UPDATE payloads by replacing the entire row. Story 8.3 piggybacks on this — no new channel.

**From Story 8.1 (KDS Route & Tablet-Optimized Layout):**
- Wake-lock effect hardened with `cancelled`/`acquiring` guards. **DO NOT** modify.
- Empty-state uses `py-24 text-center`. **DO NOT** modify.

### Latest Tech Information

- **`tailwindcss-animate` ^1.0.7**: provides `animate-out`, `slide-out-to-right`, `duration-200`, `fill-mode-forwards`, `motion-reduce:animate-none`. All available without config changes in `tailwind.config.ts` (plugin is already in the `plugins` array). No `keyframes` or `animation` extension is needed in `theme.extend`.
- **`prefers-reduced-motion`**: Tailwind's `motion-reduce:` variant maps to `@media (prefers-reduced-motion: reduce)`. Use `motion-reduce:animate-none` on the exit animation element to opt out for users who request reduced motion.
- **React 19 + Next.js 15 `useEffect` cleanup**: `setTimeout` returned ID is fine; clean via `clearTimeout(id)` in the cleanup function. React 19 does not change `useEffect` semantics here.
- **`fireEvent.click` vs `userEvent.click`**: this project uses `fireEvent.click` (per Story 5.2 and 8.2 tests). Stay consistent — do not introduce `@testing-library/user-event` (not installed).
- **`vi.useFakeTimers({ shouldAdvanceTime: true })`**: not necessary for this story's timer tests; the default fake-timer behavior with `vi.advanceTimersByTime(5_001)` wrapped in `act()` is sufficient. Mirror the pattern from Story 8.2's `30s tick` test.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **Server Action `ActionResult<T>` pattern** — `unbumpOrder` returns `Promise<ActionResult<void>>`; never throws; user-facing error string is actionable ("Tap to retry — undo didn't send").
- **Owner cookie client for `unbumpOrder`** — `createClient()` from `lib/supabase/server.ts`. NOT the admin client.
- **No `.select()` on RLS-gated UPDATEs** — same rule as customer INSERTs; the `markOrderHandled` precedent in 5.2 confirms this for owner UPDATEs.
- **Tailwind only; design tokens only; `sm` and `lg` breakpoints only** — the Undo affordance uses `bg-surface-overlay`, `text-text-primary`, `text-error`; no `md:` breakpoints.
- **No new dependencies** — `tailwindcss-animate` is already installed.
- **Comments default to none** — the `.eq('is_handled', true)` idempotency guard deserves a one-line WHY comment (matches the 5.2 precedent for `markOrderHandled`). The 5s setTimeout cleanup deserves a one-line comment about cancel-on-re-bump.
- **`Order` type's `handled_at: string | null`** — both `null` and a populated ISO string are valid. `unbumpOrder` writes `null`. `markOrderHandled` writes the app-clock ISO string. Realtime echo replaces with server-clock.
- **Anti-pattern: do NOT re-introduce the JWT customer session path** — Story 8.3 is owner-only, so this doesn't apply directly, but the broader rule "no `auth.users` rows for customers" remains.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — sparse on Phase-2 KDS specifics; the bridge pattern is documented in the Story 8.2 spec and reaffirmed here.
- Epics: `_bmad-output/planning-artifacts/epics.md` lines 1152-1179 — source ACs for Story 8.3.
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR51 (bump action — THIS story).
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md:824, 860` — UX-DR17 "no toast / calm by design" + "feedback persistent until user takes action". `epics.md:138` for the original DR definition.
- Project Context: `_bmad-output/project-context.md` — Server Action discipline, no toasts, optimistic-update conventions, animation library policy (Tailwind utilities only).
- Prior art: `_bmad-output/implementation-artifacts/5-2-order-management-mark-handled-session-history.md` — `markOrderHandled` + optimistic store pattern; the rollback gap that 8.3 upgrades.
- Prior art: `_bmad-output/implementation-artifacts/8-1-kds-route-tablet-optimized-layout.md` — wake-lock effect, `KdsScreen` structure, KDS-on-tablet design rationale.
- Prior art: `_bmad-output/implementation-artifacts/8-2-order-tickets-sequence-priority-signals.md` — `OrderTicket` structure, sort + tick patterns, the test patterns to mirror (mocking, fake timers, structural assertions).
- Prior art: `components/admin/OrderFeed.tsx` — `handleMarkHandled` reference for the optimistic + Server Action pattern.
- Prior art: `components/admin/OrderCard.tsx` — `aria-label` composition pattern (do not import, just mirror).
- MDN: WAI-ARIA `role="alert"` — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alert_role
- MDN: `prefers-reduced-motion` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- tailwindcss-animate docs: https://github.com/jamiebuilds/tailwindcss-animate (utility class reference)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- KdsScreen `consecutive bumps` unit test: initial version clicked `bumpBtns[0]` twice (same button) because the mock store doesn't flip `is_handled`, so both tickets remain sorted with A first. Fixed by using `getByRole('button', { name: /bump order for table N/i })` aria-label targeting to click specific tickets by table number.

### Completion Notes List

- Task 1: Added `unbumpOrder` Server Action to `actions/orderActions.ts`. Uses server cookie client, `.eq('is_handled', true)` idempotency guard, no `.select()`, returns `ActionResult<void>`. Mirrors `markOrderHandled` pattern exactly.
- Task 2: Added `unmarkHandled(orderId)` to `stores/orderStore.ts` interface and implementation. Symmetric to `markHandled`; uses immutable `.map()`. Did not rename or change `markHandled`.
- Task 3: Rewrote `KdsScreen.tsx` with `bumpingIds`, `recentlyBumped`, `bumpError`, `undoError` state. Animation-aware active filter keeps mid-animation tickets visible. `handleBump` does optimistic update → Server Action → rollback on failure. 250ms safety-net `setTimeout` covers `prefers-reduced-motion` path. Undo affordance fixed-position at `bottom-4`. `useEffect` with `recentlyBumped` dependency resets the 5s timer on consecutive bumps (AC #7).
- Task 4: Updated `OrderTicket.tsx` props interface; wired bump click with `disabled={isBumping}`, slide-out animation classes on `<article>` when `isBumping`, `onAnimationEnd` guard, inline error with `role="alert"`.
- Task 5: Updated `OrderTicket.test.tsx` — all 15 existing tests updated to pass new required props via `defaultProps` spread; 11 new tests added covering bump click, table label passthrough, disable-during-flight, animation classes, `onAnimationEnd` guard, inline error, error dismiss sequencing.
- Task 6: Updated `KdsScreen.test.tsx` — store mock extended with `getState()` returning `markHandledMock`/`unmarkHandledMock`; Server Action mock added; 9 new tests covering bump orchestration, rollback, Undo, 5s timer, consecutive bump tracking and timer reset.
- Task 7: Added 2 E2E tests to `admin-kds.spec.ts` — bump removes ticket + verifies DB state; Undo restores ticket + verifies DB state. Uses existing `beforeAll` fixtures and `createTestTable`/`createTestOrder` helpers.
- Task 8: Left for manual verification by user.
- All 468 unit tests pass. No regressions.

### File List

- `actions/orderActions.ts` — Added `unbumpOrder` Server Action
- `stores/orderStore.ts` — Added `unmarkHandled` store action
- `components/admin/KdsScreen.tsx` — Added bump/undo orchestration, animation-aware filter, Undo affordance
- `components/admin/OrderTicket.tsx` — Added bump props, slide-out animation, inline error
- `tests/unit/admin/OrderTicket.test.tsx` — Updated existing tests + 11 new bump/animation/error tests
- `tests/unit/admin/KdsScreen.test.tsx` — Extended mock + 9 new orchestration/timer tests
- `tests/e2e/admin-kds.spec.ts` — Added 2 E2E tests for bump and Undo flows

### Change Log

- 2026-05-20: Story 8.3 implemented — bump-to-complete workflow with optimistic update, 200ms slide-out animation, 5s Undo affordance, rollback on failure, inline errors (no toasts), double-tap guard, consecutive-bump timer reset. All ACs satisfied. 468 unit tests pass.
- 2026-05-20: Code review patches applied (14 items) — synchronous re-entrancy guards via refs (bump + undo in-flight), per-id safety-net timers with unmount cleanup, undo error auto-dismiss, animation event target check, banner-protection on rollback (`recentlyBumped` id check), grid bottom padding for fixed Undo banner, test mocks recreated per render, E2E selectors made table-specific, E2E DB-state polls. 468 unit tests pass; no new TS errors.
