# Story 9.2: Admin UI — Inline Status Controls

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to advance an order's status from the order feed without leaving the page,
so that the kitchen and front of house share a single workflow surface and customers see live status updates without paper tickets or verbal handoffs.

## Acceptance Criteria

1. **Given** an owner is on `/admin/orders` and an order is in `received`, `preparing`, `ready`, or `completed` status
   **When** the OrderCard renders
   **Then** the leading 8px status dot reflects the current `order.status` via design tokens:
   - `received` → `bg-accent` (orange #FF6B35, current "active" color)
   - `preparing` → `bg-info` (new blue token — added in Task 1)
   - `ready` → `bg-success` (green #34C759)
   - `completed` → `bg-text-secondary opacity-40` (current "handled" muted look)
   **And** the row opacity dims (`opacity-40`) only when `status === 'completed'` — `preparing` and `ready` rows render at full opacity
   **And** the existing `order.is_handled`-based dot/opacity logic is removed from `OrderCard.tsx`

2. **Given** an OrderCard is rendered
   **When** `order.status === 'received'`
   **Then** the inline text action reads `"Mark preparing"` and tapping advances via `advanceOrderStatus(orderId, 'preparing')`
   **And when** `order.status === 'preparing'` the action reads `"Mark ready"` and advances to `'ready'`
   **And when** `order.status === 'ready'` the action reads `"Mark completed"` and advances to `'completed'`
   **And when** `order.status === 'completed'` no action link is shown (terminal state)
   **And** the action button's `aria-label` includes the table label, current status, and target status (e.g. `"Mark Table 4 ready (currently preparing)"`)

3. **Given** an owner taps a status action link
   **When** the optimistic flow runs
   **Then** `useOrderStore.getState().updateStatus(orderId, nextStatus)` is invoked immediately to advance the local state (so the OrderCard re-renders before the network round-trip)
   **And** `advanceOrderStatus(orderId, nextStatus)` is then called from `actions/orderActions.ts`
   **And** on `{ success: true }`, the Realtime UPDATE event reconciles the row (idempotent with the optimistic write)
   **And** on `{ success: false }`, the store rolls back to the previous status via `updateStatus(orderId, previousStatus)` and an inline error message appears on the card

4. **Given** the action returns `{ success: false }`
   **When** the inline error is shown
   **Then** the message is keyed off `result.code` (per memory `feedback_action_error_codes.md`):
   - `'CONCURRENT_UPDATE'` → `"Order changed — please refresh"`
   - `'INVALID_TRANSITION'` → `"Order state changed — please refresh"`
   - `'UPDATE_FAILED'` → `"Tap to retry — update didn't send"`
   - `'NOT_AUTHENTICATED'` → `"Session expired — please log in"`
   - `'NOT_FOUND'` → `"Order not found — please refresh"`
   **And** the action link re-enables for retry (the optimistic state has already rolled back)
   **And** a synchronous in-flight guard (per-orderId) prevents double-tap firing two server actions before the first settles

5. **Given** the OrderFeed tabs (`Active` / `Handled` / `All`)
   **When** the tab filter runs
   **Then** `Active` shows orders where `status !== 'completed'` (replacing the prior `!order.is_handled`)
   **And** `Handled` shows orders where `status === 'completed'` (replacing the prior `order.is_handled === true`)
   **And** `All` shows every order, unchanged
   **And** no behavior depends on reading `is_handled` from the row in `OrderFeed.tsx` after this change

6. **Given** the existing `markOrderHandled` Server Action
   **When** Story 9.2 lands
   **Then** the function is **deleted** from `actions/orderActions.ts`
   **And** all callers (`OrderFeed.handleMarkHandled`, `KdsScreen.handleBump`, every test) migrate to `advanceOrderStatus`
   **And** the import path `import { markOrderHandled } from '@/actions/orderActions'` no longer resolves anywhere in the codebase

7. **Given** the KdsScreen (Story 8.3 — kitchen surface)
   **When** Story 9.2 lands
   **Then** the active-ticket filter changes from `!o.is_handled` to `o.status === 'preparing' || bumpingIds.has(o.id)` — KDS shows only orders the kitchen is actively cooking, plus mid-animation tickets
   **And** `handleBump` calls `advanceOrderStatus(orderId, 'ready')` (per Epic 8.3 line 1162) instead of `markOrderHandled`
   **And** `handleUndo` calls the rewritten `unbumpOrder` (see AC #8) to revert `ready → preparing`
   **And** the optimistic store mutations switch from `markHandled`/`unmarkHandled` to `updateStatus(orderId, 'ready')` / `updateStatus(orderId, 'preparing')`
   **And** the bump animation, undo affordance, error toast, and wake-lock behavior remain unchanged from Story 8.3

8. **Given** the existing `unbumpOrder` Server Action
   **When** Story 9.2 lands
   **Then** the function is **rewritten** (not removed) to revert status `ready → preparing` instead of toggling `is_handled`:
   - Reads current status under RLS; only proceeds when `current === 'ready'`
   - UPDATE sets `status = 'preparing'`, `is_handled = false`, `handled_at = null` atomically (single statement)
   - Uses optimistic-concurrency filter `eq('status', 'ready')` and `count: 'exact'` for 0-row detection
   - Returns the same `ActionResult.code` taxonomy as `advanceOrderStatus` (`NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_TRANSITION`, `UPDATE_FAILED`, `CONCURRENT_UPDATE`)
   - Does **not** chain `.select()` (per the 42501/RETURNING anti-pattern; same guard as `advanceOrderStatus`)

9. **Given** the Zustand `orderStore`
   **When** Story 9.2 lands
   **Then** a new action `updateStatus(orderId: string, status: OrderStatus)` is added:
   - Sets `status` on the matching order
   - When `status === 'completed'`, also sets `is_handled = true` and `handled_at = new Date().toISOString()` to keep the local invariant aligned with what `advanceOrderStatus` writes server-side
   - When `status === 'preparing'` AND the prior status was `'ready'` or `'completed'` (revert path), also sets `is_handled = false` and `handled_at = null`
   - Is a no-op if no matching order exists (defensive, matches `updateOrder` pattern)
   **And** the deprecated `markHandled` and `unmarkHandled` actions are **removed** from the store; their call sites are migrated to `updateStatus`

10. **Given** a new design token requirement for `preparing` blue
    **When** the migration runs
    **Then** `app/globals.css` defines `--info` for both light (`#007AFF` Apple system blue) and dark (`#0A84FF` Apple system blue dark) themes
    **And** `tailwind.config.ts` exposes `info: "var(--info)"` under `theme.extend.colors`
    **And** the `bg-info` class is used by the OrderCard status dot for `preparing` orders — no other component should hardcode this color

11. **Given** the test suite
    **When** Story 9.2 lands
    **Then** unit tests cover:
    - OrderCard renders the correct dot color and action label for each of the four `status` values
    - OrderCard hides the action link when `status === 'completed'`
    - OrderFeed Active/Handled tab filters operate on `status`, not `is_handled`
    - OrderFeed `handleAdvance(orderId, nextStatus)` rolls back the store on `{ success: false }` and shows the correct error message per `code`
    - OrderFeed double-tap guard prevents two concurrent action calls for the same orderId
    - KdsScreen filter excludes `received` and `completed` orders; only `preparing` (+ animating) tickets are visible
    - KdsScreen handleBump calls `advanceOrderStatus(_, 'ready')` and rolls back on failure
    - KdsScreen handleUndo calls `unbumpOrder` and restores the local store
    - orderStore.updateStatus correctly maintains the `is_handled` invariant for `completed` and revert paths
    - rewritten `unbumpOrder` returns `INVALID_TRANSITION` when current status is not `ready`; returns `CONCURRENT_UPDATE` on 0-row UPDATE; mirrors `advanceOrderStatus` error taxonomy
    **And** the existing tests for `markOrderHandled` are deleted; the tests for `markHandled`/`unmarkHandled` store actions are deleted or replaced with `updateStatus` equivalents

---

## Tasks / Subtasks

- [x] **Task 1 — Add `info` design token** (AC: #1, #10)
  - [x] Edit `app/globals.css`: add `--info: #007AFF;` to the light-theme `:root` block (around the existing `--success`/`--warning` lines) and `--info: #0A84FF;` to the dark-theme `.dark` block (matching position).
  - [x] Edit `tailwind.config.ts`: add `info: "var(--info)"` to `theme.extend.colors` (sibling of `success`/`warning`).
  - [x] **DO NOT** add the color anywhere else — `OrderCard.tsx` is the sole consumer in 9.2. Hardcoding the hex elsewhere violates the project-context rule "Never hardcode color hex values — use design-md system tokens".
  - [x] Verify the class compiles by adding `<span className="bg-info" />` temporarily and running `npm run dev`. Remove the temporary node before committing.

- [x] **Task 2 — Add `updateStatus` to `orderStore` and remove `markHandled` / `unmarkHandled`** (AC: #9)
  - [x] Edit `stores/orderStore.ts`:
    - Add to the interface:
      ```ts
      updateStatus: (orderId: string, status: OrderStatus) => void
      ```
      (remove `markHandled` and `unmarkHandled` from the interface)
    - Add the import for `OrderStatus`: `import type { Order, OrderStatus } from '@/types/app'`
    - Implement the action in the `create()` body, replacing `markHandled`/`unmarkHandled`:
      ```ts
      updateStatus: (orderId, status) =>
        set((state) => {
          const existing = state.orders.find((o) => o.id === orderId)
          if (!existing) return state
          const isCompleting = status === 'completed'
          const isRevertingFromTerminal =
            status === 'preparing' && (existing.status === 'ready' || existing.status === 'completed')
          return {
            orders: state.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    status,
                    is_handled: isCompleting
                      ? true
                      : isRevertingFromTerminal
                        ? false
                        : o.is_handled,
                    handled_at: isCompleting
                      ? new Date().toISOString()
                      : isRevertingFromTerminal
                        ? null
                        : o.handled_at,
                  }
                : o,
            ),
          }
        }),
      ```
  - [x] **DO NOT** keep `markHandled` or `unmarkHandled` as deprecated wrappers — clean break. Every call site is migrated in Tasks 4 and 5; no orphaned imports remain.
  - [x] Update the `OrderStore` interface to remove the two deleted actions.

- [x] **Task 3 — Add status helpers in `utils/`** (AC: #1, #2)
  - [x] Create `utils/orderStatus.ts`:
    ```ts
    import type { OrderStatus } from '@/types/app'

    export const STATUS_DOT_CLASS: Record<OrderStatus, string> = {
      received: 'bg-accent',
      preparing: 'bg-info',
      ready: 'bg-success',
      completed: 'bg-text-secondary opacity-40',
    }

    export const NEXT_STATUS_LABEL: Record<OrderStatus, string | null> = {
      received: 'Mark preparing',
      preparing: 'Mark ready',
      ready: 'Mark completed',
      completed: null,
    }

    export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
      received: 'preparing',
      preparing: 'ready',
      ready: 'completed',
      completed: null,
    }
    ```
  - [x] These three maps deliberately duplicate the shape of the server-side `VALID_NEXT_STATUS` in `actions/orderActions.ts` (kept separate so client-side rendering doesn't import a `'use server'` module). Keep them in sync if the transition rules change.
  - [x] **DO NOT** add error-code → message mapping here. That belongs co-located with the UI consumer (OrderFeed) where the copy is tuned to context.

- [x] **Task 4 — Refactor `OrderCard` for status-aware rendering** (AC: #1, #2, #3, #4)
  - [x] Edit `components/admin/OrderCard.tsx`:
    - Replace the `onMarkHandled?: () => void` prop with `onAdvance?: (nextStatus: OrderStatus) => void` and add `errorMessage?: string | null` + `onErrorDismiss?: () => void` props (mirror the `OrderTicket` error-prop pattern from Story 8.3).
    - Import `STATUS_DOT_CLASS`, `NEXT_STATUS_LABEL`, `NEXT_STATUS` from `@/utils/orderStatus`.
    - Compute:
      - `const dotClass = STATUS_DOT_CLASS[order.status]`
      - `const actionLabel = NEXT_STATUS_LABEL[order.status]`
      - `const nextStatus = NEXT_STATUS[order.status]`
      - `const rowOpacity = order.status === 'completed' ? 'opacity-40' : ''` (replaces the `is_handled` check)
    - Replace the existing dot `<span ... bg-text-secondary | bg-accent>` with `<span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />`
    - Replace the "Mark handled" button with a conditional advance button:
      ```tsx
      {actionLabel && nextStatus && onAdvance && (
        <button
          type="button"
          onClick={() => {
            if (errorMessage) onErrorDismiss?.()
            onAdvance(nextStatus)
          }}
          aria-label={`${actionLabel} for ${tableLabel} (currently ${order.status})`}
          className="px-4 pb-2 text-sm text-accent"
        >
          {actionLabel}
        </button>
      )}
      ```
    - Render `errorMessage` if present below the button:
      ```tsx
      {errorMessage && (
        <p className="px-4 pb-2 text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}
      ```
    - Update the parent button's `aria-label` to include the status: `"Order for Table 4, preparing, Burger +1 more, 2 min ago"` (insert `order.status` between the table label and the summary).
  - [x] **DO NOT** import `is_handled` reads back into the component — the prior usages are migrated to `order.status`. The field remains on the type but is no longer read here.
  - [x] **DO NOT** remove the inline-expand panel logic — it's unrelated to status and stays as-is.

- [x] **Task 5 — Refactor `OrderFeed` for status-based filtering + new advance flow** (AC: #3, #4, #5, #6)
  - [x] Edit `components/admin/OrderFeed.tsx`:
    - Replace the `markOrderHandled` import with `advanceOrderStatus`.
    - Replace the filter logic:
      ```ts
      const filteredOrders =
        activeTab === 'active'
          ? orders.filter((o) => o.status !== 'completed')
          : activeTab === 'handled'
            ? orders.filter((o) => o.status === 'completed')
            : orders
      ```
    - Replace `handleMarkHandled` with `handleAdvance`:
      ```ts
      const inFlightRef = useRef<Set<string>>(new Set())
      const [errors, setErrors] = useState<Record<string, string>>({})

      async function handleAdvance(orderId: string, nextStatus: OrderStatus) {
        if (inFlightRef.current.has(orderId)) return  // double-tap guard (AC #4)
        inFlightRef.current.add(orderId)

        const prev = useOrderStore.getState().orders.find((o) => o.id === orderId)
        if (!prev) {
          inFlightRef.current.delete(orderId)
          return
        }

        useOrderStore.getState().updateStatus(orderId, nextStatus)  // optimistic
        setErrors((e) => {
          if (!(orderId in e)) return e
          const { [orderId]: _, ...rest } = e
          return rest
        })

        try {
          const result = await advanceOrderStatus(orderId, nextStatus)
          if (!result.success) {
            useOrderStore.getState().updateStatus(orderId, prev.status)  // rollback
            setErrors((e) => ({ ...e, [orderId]: errorMessageFor(result.code) }))
          }
        } finally {
          inFlightRef.current.delete(orderId)
        }
      }

      function dismissError(orderId: string) {
        setErrors((e) => {
          if (!(orderId in e)) return e
          const { [orderId]: _, ...rest } = e
          return rest
        })
      }
      ```
    - Add a module-level error-message map (co-located, per Task 3 note):
      ```ts
      const ERROR_MESSAGE: Record<string, string> = {
        CONCURRENT_UPDATE: 'Order changed — please refresh',
        INVALID_TRANSITION: 'Order state changed — please refresh',
        UPDATE_FAILED: "Tap to retry — update didn't send",
        NOT_AUTHENTICATED: 'Session expired — please log in',
        NOT_FOUND: 'Order not found — please refresh',
      }
      function errorMessageFor(code: string | undefined): string {
        return (code && ERROR_MESSAGE[code]) || "Tap to retry — update didn't send"
      }
      ```
    - Pass `onAdvance={(next) => handleAdvance(order.id, next)}`, `errorMessage={errors[order.id] ?? null}`, and `onErrorDismiss={() => dismissError(order.id)}` to each `<OrderCard />`.
  - [x] **DO NOT** keep the `onMarkHandled` prop name — every reference must be migrated. Tests check prop wiring.
  - [x] **DO NOT** read `order.is_handled` anywhere in this file after the change.

- [x] **Task 6 — Refactor `KdsScreen` for status-based filtering + new bump/undo flow** (AC: #7)
  - [x] Edit `components/admin/KdsScreen.tsx`:
    - Replace the `markOrderHandled, unbumpOrder` imports with `advanceOrderStatus, unbumpOrder` (unbumpOrder remains, but its semantics change in Task 7).
    - Replace the active-orders filter (line 59-61 today):
      ```ts
      const activeOrders = orders
        .filter((o) => o.status === 'preparing' || bumpingIds.has(o.id))
        .slice()
        .sort(/* unchanged */)
      ```
    - In `handleBump`:
      - Replace `useOrderStore.getState().markHandled(orderId)` with `useOrderStore.getState().updateStatus(orderId, 'ready')`
      - Replace `await markOrderHandled(orderId)` with `await advanceOrderStatus(orderId, 'ready')`
      - On rollback (the `!result.success` branch): replace `useOrderStore.getState().unmarkHandled(orderId)` with `useOrderStore.getState().updateStatus(orderId, 'preparing')`
      - The `bumpError` message stays as-is for now; if the user wants per-`code` differentiation on KDS, that's a separate enhancement (out of scope for 9.2).
    - In `handleUndo`:
      - Replace `useOrderStore.getState().unmarkHandled(orderId)` with `useOrderStore.getState().updateStatus(orderId, 'preparing')`
      - Keep `await unbumpOrder(orderId)` — the action signature stays the same but its behavior is rewritten in Task 7.
      - On rollback inside `handleUndo` (the `!result.success` branch): replace `if (beforeRestore?.is_handled) useOrderStore.getState().markHandled(orderId)` with `if (beforeRestore?.status === 'ready') useOrderStore.getState().updateStatus(orderId, 'ready')` (restore to the `ready` state we just undid).
  - [x] **DO NOT** change the bump animation timing, wake-lock logic, undo banner UX, or safety-net timers from Story 8.3 — those are out of scope.
  - [x] **DO NOT** change the bump button's destination status — Epic 8.3 (line 1162) explicitly says `advanceOrderStatus(orderId, 'ready')`. The KDS does not advance to `completed`.

- [x] **Task 7 — Rewrite `unbumpOrder` Server Action** (AC: #8)
  - [x] Edit `actions/orderActions.ts`:
    - Rewrite `unbumpOrder` to revert `ready → preparing` with the same hardening as `advanceOrderStatus`:
      ```ts
      export async function unbumpOrder(orderId: string): Promise<ActionResult<void>> {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

        const { data: current, error: readError } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single()
        if (readError || !current) {
          return { success: false, error: 'Order not found', code: 'NOT_FOUND' }
        }

        if ((current.status as OrderStatus) !== 'ready') {
          return { success: false, error: 'Invalid status transition', code: 'INVALID_TRANSITION' }
        }

        // Reverse transition: ready → preparing. Atomic with is_handled/handled_at reset
        // (in case any prior transition mistakenly set them).
        const { error, count } = await supabase
          .from('orders')
          .update({ status: 'preparing', is_handled: false, handled_at: null }, { count: 'exact' })
          .eq('id', orderId)
          .eq('status', 'ready')

        if (error) {
          console.error('[unbumpOrder]', error)
          return { success: false, error: "Tap to retry — undo didn't send", code: 'UPDATE_FAILED' }
        }
        if (count === 0) {
          return { success: false, error: 'Order changed — please refresh', code: 'CONCURRENT_UPDATE' }
        }
        return { success: true, data: undefined }
      }
      ```
  - [x] **DO NOT** route this through `advanceOrderStatus` — that action's `VALID_NEXT_STATUS` map explicitly disallows reverse transitions. `unbumpOrder` is the dedicated escape hatch and its scope (only `ready → preparing`) is narrow enough that duplication is cleaner than a generalized reverter.
  - [x] **DO NOT** allow `unbumpOrder` to revert from `completed` — KDS only ever bumps to `ready`, so only `ready` is undoable from the KDS surface. If a need to revert `completed → ready` appears later (e.g. a future "Mark completed" undo on OrderCard), that's a separate Server Action.

- [x] **Task 8 — Delete `markOrderHandled` Server Action** (AC: #6)
  - [x] Edit `actions/orderActions.ts`:
    - Delete the entire `markOrderHandled` function (currently `actions/orderActions.ts:179-198`).
    - Verify no other file imports it: `grep -r "markOrderHandled" --include="*.ts" --include="*.tsx" .` should return ZERO matches outside the deletion site (after Tasks 5 and 6 migrate the call sites).
  - [x] **DO NOT** leave the function as a deprecated stub — clean break.
  - [x] **DO NOT** also delete `unbumpOrder` — it survives, rewritten per Task 7.

- [x] **Task 9 — Unit-test migration and additions** (AC: #11)
  - [x] `tests/unit/admin/OrderCard.test.tsx`:
    - Update the `makeOrder` factory: every test that asserts the dot color should now pass an explicit `status` (the factory's default `status: 'received'` from Story 9.1 stays as-is).
    - Add tests: dot class for each of the 4 statuses; action label for each non-terminal status; action hidden when `status === 'completed'`; `onAdvance(nextStatus)` is called with the correct target on click; `errorMessage` renders below the button with `role="alert"`; `onErrorDismiss` fires on click before `onAdvance`.
    - Remove tests that assert on `is_handled`-based dot color or row opacity.
  - [x] `tests/unit/admin/OrderFeed.test.tsx`:
    - Update the `markOrderHandled` mock to mock `advanceOrderStatus` instead.
    - Update the `makeOrder` factory tests to seed orders with the appropriate `status` values for tab-filter assertions (`status: 'completed'` for Handled tab, `status: 'received'`/`'preparing'`/`'ready'` for Active).
    - Replace existing tab-filter tests: `Active` shows non-completed; `Handled` shows completed; `All` shows everything.
    - Add tests: optimistic update + rollback on failure; per-`code` error-message rendering; double-tap guard prevents two concurrent action calls; error dismisses when the user re-taps the button.
    - Remove tests for `markOrderHandled` directly.
  - [x] `tests/unit/admin/KdsScreen.test.tsx`:
    - Update mocks: `vi.mock('@/actions/orderActions')` exports `advanceOrderStatus` and `unbumpOrder`, NOT `markOrderHandled`.
    - Update fixture seeding: orders need `status: 'preparing'` to appear on the KDS (the filter now excludes `received`).
    - Verify the bump-to-`ready` path: the captured action call is `advanceOrderStatus(orderId, 'ready')`.
    - Verify the undo path: the captured action call is `unbumpOrder(orderId)`; on success the store has the order back at `status === 'preparing'`.
    - Verify the rollback path: on `advanceOrderStatus` failure, the store reverts to `preparing` (not unsetting `is_handled`).
    - Add a test: an order with `status === 'received'` does NOT appear on the KDS (proves the new filter).
    - Add a test: an order with `status === 'completed'` does NOT appear on the KDS.
  - [x] `tests/unit/admin/OrderTicket.test.tsx`:
    - Update `makeOrder` factory default to `status: 'preparing'` (the only status that appears on KDS post-9.2).
    - No behavior changes; the leaf component doesn't read `status`.
  - [x] `tests/unit/stores/orderStore.test.ts`:
    - Delete the `markHandled` / `unmarkHandled` describe blocks.
    - Add `describe('updateStatus')` with cases:
      - Sets `status` only when target is `preparing` or `ready` (no `is_handled`/`handled_at` change).
      - Sets `status='completed'` AND `is_handled=true` AND `handled_at` to an ISO string when target is `completed`.
      - Resets `is_handled=false` AND `handled_at=null` when target is `preparing` AND prior status was `ready` or `completed` (revert path).
      - Is a no-op when no matching order exists.
      - Does NOT touch other orders in the array.
  - [x] `tests/unit/actions/orderActions.test.ts`:
    - Delete the `markOrderHandled` describe block (the function is gone).
    - Add `describe('unbumpOrder')` mirroring the `advanceOrderStatus` test layout: each of `NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_TRANSITION` (current status ≠ ready), `UPDATE_FAILED`, `CONCURRENT_UPDATE` (count: 0), and the success path. Use the existing `makeOwnerClient` helper from the 9.1 tests — reuse, don't re-author.
  - [x] **DO NOT** mock the database for any of these — these are all Vitest unit tests of pure logic + chain-mocked Supabase, NOT RLS tests. RLS tests are out of scope for 9.2 (the action contract is already covered by 9.1's `tests/rls/order-status.spec.ts`).

### Review Findings

Findings from the 2026-05-20 code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor).

- [x] **[Review][Patch]** Rollback in `handleAdvance` / `handleBump` / `handleUndo` could overwrite Realtime echoes from other actors — resolved 2026-05-20 by skipping the local-store rollback for `CONCURRENT_UPDATE` and `INVALID_TRANSITION` codes (state-desync codes where Realtime will deliver the truth). Transport / identity codes (`UPDATE_FAILED`, `NOT_AUTHENTICATED`, `NOT_FOUND`) still roll back. Inline error message is shown in both cases. [`components/admin/OrderFeed.tsx`, `components/admin/KdsScreen.tsx`]

- [x] **[Review][Patch]** Rollback from optimistic non-`preparing` transitions left `is_handled` / `handled_at` desynced with `status` — resolved 2026-05-20 by simplifying `updateStatus` to maintain the `is_handled ⇔ status==='completed'` invariant unconditionally (any non-completed target now clears both fields). Added test for the `completed → ready` rollback path. [`stores/orderStore.ts`, `tests/unit/stores/orderStore.test.ts`]


- [ ] **Task 10 — Manual smoke test against a real DB** (AC: #1–#9, satisfies the Done Gate from Story 9.1's code review)
  - [ ] Start local Supabase (`supabase start`) and the dev server (`npm run dev`).
  - [ ] Sign in as the test owner.
  - [ ] Submit a customer order (via the customer flow at `/{slug}/{table}`). Confirm it appears on `/admin/orders` with the orange (`bg-accent`) dot and a "Mark preparing" link.
  - [ ] Tap "Mark preparing" — confirm the dot turns blue (`bg-info`) and the link becomes "Mark ready" within ~300ms (optimistic).
  - [ ] Confirm the order now appears on `/admin/kds` (filter: `status === 'preparing'`).
  - [ ] Tap Bump on KDS — confirm the ticket slides out within 200ms; on `/admin/orders` the order is now showing the green (`bg-success`) dot with a "Mark completed" link.
  - [ ] Within 5s of bump, tap Undo — confirm the ticket reappears on KDS and the OrderFeed dot returns to blue.
  - [ ] Tap Bump again; then on OrderFeed tap "Mark completed" — confirm the order moves to the Handled tab with the grey muted dot and no action link.
  - [ ] Verify in `supabase db psql` (or the dashboard): the row has `status='completed'`, `is_handled=true`, `handled_at IS NOT NULL`.
  - [ ] **Error-path probe:** Open two browser windows side-by-side (both signed in as the same owner). In window A, tap "Mark preparing". In window B (before Realtime echoes), tap "Mark preparing" again. Window B should show the inline error `"Order state changed — please refresh"` (the `INVALID_TRANSITION` code, since the read in window B will see status=preparing but the action's validator rejects preparing → preparing). The optimistic UI in window B should have rolled back.
  - [ ] Confirms Story 9.1's Done Gate is also satisfied — both stories can flip to `done` together.

---

## Dev Notes

### Why the workflow split between OrderFeed and KDS

After 9.2, the kitchen and front-of-house share one status enum but operate on disjoint slices:

| Surface | Filter | Action | Target status |
|---|---|---|---|
| `/admin/orders` Active | `status !== 'completed'` | "Mark preparing" / "Mark ready" / "Mark completed" | next state |
| `/admin/orders` Handled | `status === 'completed'` | (read-only) | — |
| `/admin/kds` | `status === 'preparing'` | "Bump" | `ready` |

This is intentional: a kitchen tablet shows only the orders currently being cooked; the receiving and serving stages live on the front-of-house feed. The transition from `received → preparing` is a server-side acknowledgment (acts as "I've started this ticket"), and `ready → completed` is the closing handoff. The kitchen never advances directly to `completed` — that's a server-side decision.

If you find yourself adding a "Mark completed" button to the KDS, **stop**. That's a workflow change and belongs in a follow-up story.

### Why `unbumpOrder` is dedicated (not routed through `advanceOrderStatus`)

`advanceOrderStatus` enforces forward-only transitions via `VALID_NEXT_STATUS`. Generalizing it to handle reverse transitions would mean either (a) adding direction-aware lookup tables (more complexity, two enforcement paths in one function) or (b) loosening the contract Story 9.1 explicitly tested. Both are worse than a focused `unbumpOrder` whose only legal transition is `ready → preparing`.

The dedicated function inherits the same hardening: optimistic-concurrency `.eq('status', 'ready')`, `count: 'exact'` for 0-row detection, distinct `ActionResult.code` per failure mode, no `.select()` after UPDATE (42501/RETURNING guard).

### Realtime reconciliation — what the operator sees

1. User taps "Mark preparing" at T+0ms.
2. `updateStatus(orderId, 'preparing')` runs locally — the OrderCard re-renders within one frame (~16ms).
3. `advanceOrderStatus` HTTP request fires at T+~30ms.
4. Supabase Realtime emits an UPDATE event at T+~80–200ms with the full new row.
5. `RealtimeProvider` calls `useOrderStore.getState().updateOrder(payload)` — this overwrites the row with the server-truth version. The optimistic write and the Realtime echo converge on the same state, so the UI doesn't flicker.

If the action fails (e.g. CONCURRENT_UPDATE), step 4 never happens and the optimistic write must be rolled back manually — that's what the `prev.status` snapshot in `handleAdvance` is for.

### Error-code → message contract

Per memory `feedback_action_error_codes.md`, the action's `code` field is the truth. UI maps it to user-facing copy:

| Code | Message | UX intent |
|---|---|---|
| `CONCURRENT_UPDATE` | "Order changed — please refresh" | Another operator or Realtime echo moved the row. Refresh reconciles. |
| `INVALID_TRANSITION` | "Order state changed — please refresh" | The order's status moved between when this OrderCard rendered and when the user tapped. Refresh. |
| `UPDATE_FAILED` | "Tap to retry — update didn't send" | Transient DB error. Retryable. |
| `NOT_AUTHENTICATED` | "Session expired — please log in" | Session timed out mid-tap. |
| `NOT_FOUND` | "Order not found — please refresh" | The row was deleted (rare, e.g. tenant cleanup). |
| any other / undefined | "Tap to retry — update didn't send" | Defensive fallback. |

KDS uses a simpler message (`"Tap to retry — bump didn't send"`) preserved from Story 8.3 — kitchen UX prioritizes brevity over diagnostic depth.

### What `is_handled` still does (and why we don't drop it yet)

After 9.2, the only DB-write path that touches `is_handled` / `handled_at` is `advanceOrderStatus(_, 'completed')` (sets them) and the rewritten `unbumpOrder` (clears them). The Admin UI no longer reads either field. But the column stays because:

1. `app/platform/tenants/[restaurant_id]/page.tsx` reads `is_handled` (out of scope for 9.2 — leave alone).
2. Analytics queries in Story 7.1's RPC (`get_restaurant_analytics`) may use it (verify before any future drop migration — out of scope).
3. The RLS spec invariant (`is_handled ⇔ status='completed'`) catches drift — dropping the column would also drop that safety net.

A follow-up story (post-9.3) can remove `is_handled` and migrate the platform page. **Do not do it in 9.2.**

### Color token: why `info` and not `warning`

The existing palette has `accent` (orange), `success` (green), `warning` (amber/orange), and `error` (red). Adding the new `preparing` state could in principle reuse `warning` — but `warning` is visually close to `accent` (both orange-tinged), and a user looking at a row at arm's length would not reliably tell `received` from `preparing` if both rendered orange-ish. Apple system blue (`info` token) gives the strongest perceptual separation: orange → blue → green → grey forms a clear 4-step progression. UX directions in the spec (line 549) called for "8px status dot" with strong contrast at distance — `info` honors that intent.

### Test-coverage strategy

- **Unit tests** (Vitest, jsdom): every component branch and store mutation. ~15–20 new tests across the four touched files. Re-use the existing `makeOrder` factories from each test file (each one already had `status: 'received'` added in Story 9.1).
- **RLS tests** (Playwright, real DB): no new RLS coverage needed. Story 9.1's `tests/rls/order-status.spec.ts` already covers `advanceOrderStatus`'s contract at the DB level. The new `unbumpOrder` semantics are unit-tested only; if the manual smoke test in Task 10 surfaces issues, a follow-up RLS test for `unbumpOrder` can be added.
- **E2E tests**: out of scope. The manual smoke test in Task 10 is the integration check; per memory `feedback_real_db_smoke_test.md`, that satisfies the discipline for owner-side RLS-traversing actions.

### Anti-pattern reminders (from project-context + 9.1 learnings)

| Anti-pattern | Correct pattern (this story) |
|---|---|
| `throw new Error(...)` in a Server Action | `return { success: false, error: '...', code: 'CODE' }` |
| `.update(payload).select()` after RLS UPDATE | `.update(payload, { count: 'exact' }).eq(...).eq(...)` — check `count` |
| Hardcoded color hex (`#FF6B35`, etc.) | `bg-accent` / `bg-info` / `bg-success` / `bg-text-secondary` tokens |
| Single conflated error string for multiple failure modes | Distinct `ActionResult.code` per mode; UI maps to copy |
| `useOrderStore()` inside a Realtime callback | `useOrderStore.getState()` |
| Editing `types/supabase.ts` by hand | N/A in 9.2 — no schema change |
| Importing `lib/supabase/admin.ts` from a Client Component | N/A in 9.2 — owner cookie client only |

### Files this story touches (UPDATE) vs. files it must NOT touch

**UPDATE in 9.2:**
- `app/globals.css` — add `--info` token (light + dark)
- `tailwind.config.ts` — expose `info: "var(--info)"`
- `utils/orderStatus.ts` — NEW; status → class / label / next-status maps
- `stores/orderStore.ts` — add `updateStatus`, remove `markHandled` / `unmarkHandled`
- `actions/orderActions.ts` — delete `markOrderHandled`; rewrite `unbumpOrder` (revert `ready → preparing`)
- `components/admin/OrderCard.tsx` — status-aware dot + dynamic action label + error slot
- `components/admin/OrderFeed.tsx` — filter by status; new `handleAdvance` with rollback + double-tap guard
- `components/admin/KdsScreen.tsx` — filter by status; migrate bump/undo to `advanceOrderStatus`/`unbumpOrder`
- `tests/unit/admin/OrderCard.test.tsx`, `OrderFeed.test.tsx`, `KdsScreen.test.tsx`, `OrderTicket.test.tsx` — migrate
- `tests/unit/stores/orderStore.test.ts` — replace `markHandled`/`unmarkHandled` blocks with `updateStatus`
- `tests/unit/actions/orderActions.test.ts` — delete `markOrderHandled`; add `unbumpOrder` block

**MUST NOT touch in 9.2:**
- `supabase/migrations/*` — no schema change in this story (the migration plan is already done in 9.1's two migrations; the `is_handled` column drop is deferred to a future story)
- `types/supabase.ts` — auto-generated; no schema change means no regeneration
- `types/app.ts` — `Order` interface stays as-is; `OrderStatus` was added in 9.1
- `actions/orderActions.ts → advanceOrderStatus` — that function's contract is frozen by 9.1's tests; do not modify
- `components/customer/*`, `app/[restaurant_slug]/*` — Story 9.3 territory
- `components/shared/RealtimeProvider.tsx` — already broadcasts UPDATE events (Story 5.1); no changes needed
- `app/platform/tenants/[restaurant_id]/page.tsx` — uses `is_handled`; cross-cutting; deferred
- `tests/rls/order-status.spec.ts` — 9.1's RLS coverage of `advanceOrderStatus` is sufficient

### Bridge for Story 9.3 (customer status tracking)

- 9.3 will subscribe to Realtime UPDATE events on `orders` filtered by `id=eq.{orderId}`. The view `orders_customer_status` exists from the 9.1 code-review (id + status only). 9.3 will need to choose: (a) re-add a column-limited policy on `public.orders` for anon to enable Realtime postgres_changes payload restriction, or (b) switch to Realtime broadcast / polling on the view. **9.2 makes no choice here** — the Realtime caveat is preserved untouched.
- 9.3 will also change `submitOrder` to return `id`. **9.2 does not touch `submitOrder`.**

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.2: Admin UI — Inline Status Controls]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3: Bump-to-Complete Workflow with Undo] — `advanceOrderStatus(orderId, 'ready')` is the explicit KDS contract
- [Source: _bmad-output/implementation-artifacts/9-1-order-status-data-model-server-action.md] — `advanceOrderStatus` contract, `ActionResult.code` taxonomy, `is_handled` invariant, Realtime UPDATE plumbing
- [Source: _bmad-output/project-context.md#Anti-patterns]
- [Source: _bmad-output/project-context.md#Code Quality & Style Rules] — color tokens, naming, breakpoints
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Admin order feed (Direction B, mobile)] — 8px dot, single-tap inline action
- [Source: actions/orderActions.ts:132-198] — current `advanceOrderStatus` + `unbumpOrder` implementations (post-9.1 code review)
- [Source: components/admin/OrderCard.tsx, OrderFeed.tsx, KdsScreen.tsx] — current implementations being modified
- [Memory: feedback_action_error_codes.md] — distinct `code` per failure mode
- [Memory: feedback_real_db_smoke_test.md] — manual smoke required for owner-side RLS-traversing Server Actions (Task 10 satisfies this for both `advanceOrderStatus` and the rewritten `unbumpOrder`)
- [Memory: project_postgres_42501_returning.md] — no `.select()` after RLS UPDATE

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (claude-sonnet-4-6)

### Debug Log References

None — implementation was clean. Two test assertions needed minor fixes post-first-run:
- OrderCard "No items" aria-label regex updated for the new status-inclusive format
- OrderFeed `beforeEach` added `vi.clearAllMocks()` to prevent mock call count accumulation across tests

### Completion Notes List

- Tasks 1–9 implemented and all 520 unit tests pass (up from 486 pre-story; 34 new tests added)
- `markOrderHandled` deleted; all callers migrated to `advanceOrderStatus`
- `markHandled`/`unmarkHandled` store actions deleted; all callers migrated to `updateStatus`
- `unbumpOrder` fully rewritten with same `ActionResult.code` hardening as `advanceOrderStatus`
- Task 10 (manual smoke test) is the Done Gate — both 9.1 and 9.2 flip to `done` after it passes

### File List

- `app/globals.css` — added `--info` token (light + dark)
- `tailwind.config.ts` — added `info: "var(--info)"` to colors
- `utils/orderStatus.ts` — NEW: STATUS_DOT_CLASS, NEXT_STATUS_LABEL, NEXT_STATUS maps
- `stores/orderStore.ts` — added `updateStatus`, removed `markHandled`/`unmarkHandled`
- `actions/orderActions.ts` — deleted `markOrderHandled`; rewrote `unbumpOrder` (ready → preparing)
- `components/admin/OrderCard.tsx` — status-aware dot + dynamic action label + error slot
- `components/admin/OrderFeed.tsx` — status-based filter; `handleAdvance` with rollback + double-tap guard
- `components/admin/KdsScreen.tsx` — status-based filter; bump/undo migrated to `advanceOrderStatus`/`unbumpOrder`
- `tests/unit/admin/OrderCard.test.tsx` — migrated; 17 new tests for 4-state dot, action labels, error slot
- `tests/unit/admin/OrderFeed.test.tsx` — migrated; 5 new tests for advance flow, rollback, double-tap, error codes
- `tests/unit/admin/KdsScreen.test.tsx` — migrated; 3 new filter tests; bump/undo updated
- `tests/unit/admin/OrderTicket.test.tsx` — default status updated to `'preparing'`
- `tests/unit/stores/orderStore.test.ts` — replaced markHandled/unmarkHandled tests with 7 updateStatus tests
- `tests/unit/actions/orderActions.test.ts` — added unbumpOrder describe (8 tests); fixed it.each TypeScript error
