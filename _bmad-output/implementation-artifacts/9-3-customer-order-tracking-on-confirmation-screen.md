# Story 9.3: Customer Order Tracking on Confirmation Screen

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to see the live status of my order after submission,
so that I know whether my food is being prepared or ready, without flagging down a server.

## Acceptance Criteria

1. **Given** a customer is on the cart page and taps "Place Order"
   **When** `submitOrder` succeeds
   **Then** `submitOrder`'s `data` payload includes `id` (the new order's UUID) in addition to `restaurantName` and `tableNumber`
   **And** the cart page navigates (via `router.replace`) to `/{restaurant_slug}/{table_number}/order/{order_id}` — back-button from the order tracking screen goes to the menu, not the cart
   **And** `useCartStore.getState().clearCart()` is invoked before navigation

2. **Given** a customer lands on `/{restaurant_slug}/{table_number}/order/{order_id}` (post-submit OR via reload/bookmark)
   **When** the page renders
   **Then** the page is a **Server Component** that uses the **admin client** (per the sessionless customer flow rule) to:
   - Resolve the restaurant by `slug` (404 if not found or `is_published === false`)
   - Resolve the table by `(restaurant_id, number)` (404 if not found)
   - Fetch the order by `id` and verify `order.restaurant_id === restaurant.id` AND `order.table_id === table.id` (404 on any mismatch — this is the security boundary; the anon-readable view exposes any `order_id`, but only the matching tuple renders)
   - Pass `initialStatus`, `restaurantName`, `tableNumber`, `items`, and `orderId` to the (refactored) `OrderConfirmationScreen` client component

3. **Given** the page is server-rendered
   **When** the status pill renders
   **Then** the current `order.status` is reflected immediately — no flash of the wrong state — via the `initialStatus` prop seeded from SSR
   **And** the pill labels map: `received → "Confirmed"`, `preparing → "Preparing"`, `ready → "Ready"`, `completed → "Completed"`
   **And** the pill styling reuses the Story 9.2 design tokens for consistency with the admin surface: `received → bg-accent`, `preparing → bg-info` (with `animate-pulse`), `ready → bg-success`, `completed → bg-text-secondary opacity-40`

4. **Given** the customer is on the order tracking page and `status !== 'completed'`
   **When** the polling loop runs
   **Then** the browser **anon Supabase client** polls `orders_customer_status` (view, NOT `public.orders`) every **4000ms** for the current `(id, status)` row
   **And** the loop is set up in a `useEffect` keyed by `orderId`, cleared on unmount via `clearInterval`
   **And** the in-flight guard mirrors the admin pattern: a `inFlightRef` boolean prevents a second fetch from queuing if the previous one hasn't resolved
   **And** when the polled `status` differs from the local state, the local state is updated and the pill re-renders

5. **Given** the polled status reaches `'completed'`
   **When** the response is applied to local state
   **Then** the polling interval is immediately cleared (`clearInterval`) — no further fetches after the terminal transition
   **And** the pill renders the muted `completed` style
   **And** a closing message `"Order completed — enjoy your meal"` is shown beneath the pill (replacing the standard "Sit tight while we prepare your food" subhead)

6. **Given** the status pill changes value (any transition, not just `→ completed`)
   **When** React renders the new state
   **Then** the pill element carries `aria-live="polite"` — screen-reader users hear the new status announcement without focus disruption
   **And** the pill text is wrapped in a semantically appropriate element (a `<p>` or `<span>` inside the live region — not the headline `h1`, which retains its post-submit focus behavior)

7. **Given** FR54 (status updates within 5 seconds of owner action)
   **When** the owner advances the order via `advanceOrderStatus` on the admin surface
   **Then** the customer's screen reflects the new status within `~4 seconds` worst-case (polling interval) — well within the 5s requirement
   **And** because polling is the **primary** mechanism (not a Realtime fallback), the customer-side surface never displays a "Realtime is unavailable" affordance

8. **Given** an invalid `(restaurant_slug, table_number, order_id)` tuple is requested
   **When** the SSR validation fails (slug missing, table missing, order missing, or order's restaurant/table doesn't match)
   **Then** the page renders the **same** `"This page isn't available"` 404 surface used by `/{restaurant_slug}/{table_number}/page.tsx` for invalid menus (reusable inline `MenuUnavailable`-style component is fine; do NOT introduce a new shared component)
   **And** no order data is leaked in the HTTP response body (the server-side tuple check happens before render)

9. **Given** the `OrderConfirmationScreen` is updated
   **When** the new component renders
   **Then** existing behavior is preserved:
   - Headline `"Your order is with the kitchen"` (received) / `"Your food is being prepared"` (preparing) / `"Your order is ready"` (ready) / `"Order completed — enjoy your meal"` (completed) — copy varies by status
   - Headline retains `tabIndex={-1}`, `aria-live="assertive"`, and post-mount focus (existing accessibility behavior)
   - Item list rendering (quantity × name + variant lines) is unchanged
   - Restaurant name + table number footer is unchanged
   - The green success checkmark icon stays for `received` / `preparing` / `ready` states; on `completed` the icon may stay (kept simple — do NOT add a new icon for the completed state in 9.3)

10. **Given** the test suite
    **When** Story 9.3 lands
    **Then** unit tests cover:
    - `OrderConfirmationScreen` renders the correct pill style and label for each of the four status values
    - Headline copy changes correctly per status
    - `aria-live="polite"` is present on the pill region
    - Polling hook (or inline `useEffect`) calls the view query every 4000ms with the correct `orderId` filter
    - Polling is cleared on unmount (no leaked intervals)
    - Polling stops when status reaches `'completed'`
    - Initial server-rendered `status` does not flash to a different value before polling starts (rendered = `initialStatus` on first paint)
    **And** an RLS spec test (`tests/rls/order-status.spec.ts` — extend existing) asserts that anon can SELECT from `orders_customer_status` view by id (already exists from 9.1) — no new RLS test needed for 9.3
    **And** the existing `tests/unit/customer/OrderConfirmationScreen.test.tsx` is updated for the new props/behavior

11. **Given** the rest of the customer flow
    **When** Story 9.3 lands
    **Then** the cart page no longer renders `OrderConfirmationScreen` inline (the dedicated route is now the post-submit surface)
    **And** `ConfirmedOrderState`, `confirmedOrder` state, and the `OrderConfirmationScreen` import are removed from `app/[restaurant_slug]/[table_number]/cart/page.tsx`
    **And** the "items.length === 0 → redirect to menu" `useEffect` guard is updated so it does NOT fire between `clearCart()` and `router.replace()` (e.g., guard by a `hasSubmittedRef.current === true` flag, OR call `router.replace` first before `clearCart()`)

---

## Tasks / Subtasks

- [x] **Task 1 — Extend `submitOrder` to return the new order's `id`** (AC: #1)
  - [x] Edit `actions/orderActions.ts`:
    - Update `SubmitOrderData` interface to add `id: string`
    - In `submitOrder`, chain `.select('id').single()` after `.insert(...)`. **This is allowed here** because `submitOrder` uses the **admin client** (`createAdminClient`), which uses the service role and bypasses the customer RLS / 42501 RETURNING trap that applies to the anon role. Document this inline with a one-line comment.
    - Return `{ id: inserted.id, restaurantName: restaurant.name, tableNumber }` on success
    - If the insert succeeds but `.select()` returns no row (defensive — should never happen with admin client), treat as a failure: `return { success: false, error: RETRY_ERROR }` and log via `console.error('[submitOrder] insert succeeded but row read failed')`
  - [x] Update the existing unit tests in `tests/unit/actions/orderActions.test.ts`:
    - The `makeAdminClient` factory currently returns `{ error }` from `.insert()`. Extend it to support `.insert(...).select('id').single()` chain returning `{ data: { id: 'order-uuid-xxx' }, error: null }`
    - All existing `submitOrder` tests should still pass after updating the fixture
    - Add a test: `submitOrder` returns `data.id` on success path
  - [x] **DO NOT** add `.select()` to any other Supabase INSERT in the file — the 42501 RETURNING rule still applies to anon-context writes (memory `project_postgres_42501_returning.md`). Only `submitOrder`'s admin-client insert is safe.
  - [x] **DO NOT** change `submitOrder`'s validation logic, item collapse logic, or `total_cents` computation — out of scope.

- [x] **Task 2 — Update cart page to navigate to the new order tracking route** (AC: #1, #11)
  - [x] Edit `app/[restaurant_slug]/[table_number]/cart/page.tsx`:
    - Remove the `confirmedOrder` state, `ConfirmedOrderState` interface, and the `OrderConfirmationScreen` import
    - Remove the conditional `if (confirmedOrder) return <OrderConfirmationScreen ... />` render branch
    - In `handlePlaceOrder` success path: call `useCartStore.getState().clearCart()` then `router.replace(\`/${restaurant_slug}/${table_number}/order/${result.data.id}\`)`
    - The empty-cart redirect effect needs a guard so it does NOT fire after `clearCart()` (it would race the `router.replace` and the user could briefly see the menu page). Implement with a `hasSubmittedRef = useRef(false)` set to `true` before `clearCart()`; the effect should bail when `hasSubmittedRef.current === true`. Alternative: drive the redirect off `items.length === 0 && !isSubmitting && !hasSubmittedRef.current`.
    - Keep `isSubmitting`/`submitError` state and the existing error-display affordance — only the success path changes.
  - [x] **DO NOT** rename or refactor `groupCartItems` — the new SSR route uses a different (server-side) path for items, so this helper is now used only by the cart page itself. Leaving it in place.
  - [x] **DO NOT** add `router.push` — use `router.replace` so back-button does not return to a cart with no items.

- [x] **Task 3 — Create the SSR order tracking route** (AC: #2, #8)
  - [x] Create `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx`:
    - Server Component (no `'use client'`)
    - `Props` interface: `params: Promise<{ restaurant_slug: string; table_number: string; order_id: string }>`
    - Pattern mirrors `app/[restaurant_slug]/[table_number]/page.tsx` (the menu page) — admin client + sequential resolve-and-validate:
      ```ts
      const { restaurant_slug, table_number, order_id } = await params
      const tableNum = parseInt(table_number, 10)
      if (isNaN(tableNum)) return <OrderUnavailable />

      const adminClient = createAdminClient()

      const { data: restaurant } = await adminClient
        .from('restaurants')
        .select('id, name, slug, is_published')
        .eq('slug', restaurant_slug)
        .single()
      if (!restaurant || !restaurant.is_published) return <OrderUnavailable />

      const { data: table } = await adminClient
        .from('tables')
        .select('id, number')
        .eq('restaurant_id', restaurant.id)
        .eq('number', tableNum)
        .single()
      if (!table) return <OrderUnavailable />

      const { data: order } = await adminClient
        .from('orders')
        .select('id, status, items, restaurant_id, table_id, submitted_at')
        .eq('id', order_id)
        .single()
      if (!order) return <OrderUnavailable />

      // Cross-tenant / cross-table guard: prevents URL forgery from reading other tables' orders.
      // The anon view exposes any UUID; this server-side tuple check is the security boundary.
      if (order.restaurant_id !== restaurant.id || order.table_id !== table.id) {
        return <OrderUnavailable />
      }

      return (
        <OrderConfirmationScreen
          orderId={order.id}
          initialStatus={order.status as OrderStatus}
          restaurantName={restaurant.name}
          tableNumber={table.number}
          items={(order.items as OrderItem[]).map((it) => ({
            name: it.name,
            quantity: it.quantity,
            variantNames: it.variants,
          }))}
        />
      )
      ```
    - Inline a small `OrderUnavailable` component (5–8 lines) mirroring `MenuUnavailable` from the menu page — same copy is fine: `"This page isn't available right now. Please ask your server."`
  - [x] **DO NOT** use `createClient` from `lib/supabase/server.ts` — that's the cookie client, which has no customer session. The admin client is required (per `docs/conventions/supabase-clients.md` and project-context "Sessionless customer flow").
  - [x] **DO NOT** use the anon view (`orders_customer_status`) for the SSR fetch — it only exposes `(id, status)` and would force a second admin-client query for `items`. The admin client read of `public.orders` is one round-trip; the view is for the client-side polling.
  - [x] **DO NOT** add `loading.tsx` to this route in 9.3 — the existing customer cart loading.tsx pattern is sufficient. SSR happens fast against the admin client (~50ms typical).

- [x] **Task 4 — Refactor `OrderConfirmationScreen` to accept status + orderId props** (AC: #2, #3, #5, #6, #9)
  - [x] Edit `components/customer/OrderConfirmationScreen.tsx`:
    - Update the `Props` interface:
      ```ts
      interface OrderConfirmationScreenProps {
        orderId: string
        initialStatus: OrderStatus
        restaurantName: string
        tableNumber: string | number
        items: ConfirmedItem[]
      }
      ```
    - Add `import type { OrderStatus } from '@/types/app'`
    - Add a state hook for the current status, seeded with `initialStatus`:
      ```ts
      const [status, setStatus] = useState<OrderStatus>(initialStatus)
      ```
    - Replace the static headline `"Your order is with the kitchen"` with a status-driven map (defined as a module-level constant):
      ```ts
      const HEADLINE: Record<OrderStatus, string> = {
        received: 'Your order is with the kitchen',
        preparing: 'Your food is being prepared',
        ready: 'Your order is ready',
        completed: 'Order completed — enjoy your meal',
      }
      const SUBHEAD: Record<OrderStatus, string> = {
        received: 'Thank you! Sit tight while we prepare your food.',
        preparing: 'The kitchen is working on it.',
        ready: 'Please collect your order.',
        completed: 'We hope to see you again soon.',
      }
      ```
    - Add the status pill, rendered between the headline subhead and the `<hr />`:
      ```tsx
      <p
        role="status"
        aria-live="polite"
        className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${PILL_CLASS[status]}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT_CLASS[status]}`} />
        {PILL_LABEL[status]}
      </p>
      ```
      with module-level maps:
      ```ts
      const PILL_LABEL: Record<OrderStatus, string> = {
        received: 'Confirmed',
        preparing: 'Preparing',
        ready: 'Ready',
        completed: 'Completed',
      }
      const PILL_CLASS: Record<OrderStatus, string> = {
        received: 'bg-accent/10 text-accent',
        preparing: 'bg-info/10 text-info animate-pulse',
        ready: 'bg-success/10 text-success',
        completed: 'bg-surface-overlay text-text-secondary opacity-60',
      }
      const DOT_CLASS: Record<OrderStatus, string> = {
        received: 'bg-accent',
        preparing: 'bg-info',
        ready: 'bg-success',
        completed: 'bg-text-secondary',
      }
      ```
    - Wire up the polling effect (see Task 5).
  - [x] **DO NOT** import the shape constants from `utils/orderStatus.ts` — those carry the admin-side labels ("Mark preparing" etc.) and class strings (e.g., `bg-text-secondary opacity-40` for the dot, which is correct for admin's tiny dot but wrong for a customer-facing pill that needs background + text contrast). The customer surface owns its own labels and pill styling; duplication is the right call.
  - [x] **DO NOT** add a Tailwind config change. The `bg-accent/10`, `bg-info/10`, `bg-success/10` opacity utilities work with existing tokens out of the box. If a class doesn't compile, that's the dev fixing it — not adding a new token.
  - [x] **DO NOT** change the headline ref / focus behavior — `tabIndex={-1}`, `aria-live="assertive"`, and `useEffect(() => headlineRef.current?.focus(), [])` all stay as-is so screen readers announce the success when the page lands. The pill's `aria-live="polite"` does not conflict.

- [x] **Task 5 — Add the polling loop for live status updates** (AC: #4, #5, #7)
  - [x] Inside `OrderConfirmationScreen`, add a `useEffect` keyed by `[orderId, status]`:
    ```tsx
    useEffect(() => {
      // Terminal state: no further updates possible. Skip the interval entirely.
      if (status === 'completed') return

      const supabase = createClient()  // browser anon client
      let cancelled = false
      const inFlight = { current: false }

      async function poll() {
        if (inFlight.current || cancelled) return
        inFlight.current = true
        try {
          const { data, error } = await supabase
            .from('orders_customer_status')
            .select('id, status')
            .eq('id', orderId)
            .single()
          if (cancelled) return
          if (error) {
            // Silent: transient network error. Next tick retries.
            // Do NOT surface a UI affordance — polling is the only path here.
            return
          }
          if (data && data.status && data.status !== status) {
            setStatus(data.status as OrderStatus)
          }
        } finally {
          inFlight.current = false
        }
      }

      const intervalId = setInterval(poll, 4000)
      return () => {
        cancelled = true
        clearInterval(intervalId)
      }
    }, [orderId, status])
    ```
  - [x] Add `import { createClient } from '@/lib/supabase/client'` to the top of the file.
  - [x] The effect's `status` dependency causes the interval to recreate on each status change. That's fine (and intentional): when status reaches `'completed'`, the early return prevents a new interval; the cleanup of the prior interval clears the polling. Net effect: polling stops on terminal state without an extra `clearInterval` call from inside `poll`.
  - [x] **DO NOT** use `postgres_changes` Realtime here. Per the Story 9.1 code-review migration note: anon does NOT have SELECT on `public.orders` (only on the view); postgres_changes subscribes to tables, not views. Polling on the view at 4s satisfies FR54 (≤5s) and matches the admin polling fallback pattern (4000ms).
  - [x] **DO NOT** call `realtime.setAuth()` here — the customer is sessionless. Per `RealtimeProvider.tsx`, `setAuth` is only needed for authenticated channels. Anon polling on the view requires no auth setup.
  - [x] **DO NOT** add a UI "Realtime unavailable" affordance — polling is the primary mechanism, not a fallback. The customer never knows or cares about transport.
  - [x] **DO NOT** use a polling interval other than 4000ms — matches the admin's `POLLING_INTERVAL_MS` in `RealtimeProvider.tsx`. Consistency is the value.

- [x] **Task 6 — Update existing OrderConfirmationScreen tests** (AC: #10)
  - [x] Edit `tests/unit/customer/OrderConfirmationScreen.test.tsx`:
    - Update every render call to include the new required props: `orderId="o-1"`, `initialStatus="received"` (and the other 3 statuses for new tests)
    - Mock the browser Supabase client. The polling effect calls `createClient()` from `@/lib/supabase/client` on each render where status !== 'completed'. Use `vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => mockSupabase) }))` and stub the chain `mockSupabase.from('orders_customer_status').select(...).eq(...).single()` to return `{ data: { id: 'o-1', status: 'received' }, error: null }` by default.
    - Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(4000)` to deterministically trigger a poll tick in the polling tests.
    - Add tests:
      - Renders correct headline for each of the 4 statuses (4 separate tests; loop via `it.each`)
      - Renders pill with correct label and color class for each of the 4 statuses
      - Pill has `aria-live="polite"`
      - Polling tick that returns a new status updates the pill (e.g., received → preparing)
      - When `initialStatus === 'completed'`, no `setInterval` is set up (verify by `expect(setInterval).not.toHaveBeenCalled()` after a `vi.spyOn(global, 'setInterval')`)
      - When status reaches `'completed'` via polling, the next tick does not fetch (interval was cleared on the status-change effect re-run)
      - Cleanup on unmount clears the interval (verify by checking `clearInterval` was called via spy)
      - Headline focus behavior preserved: `headlineRef.current` is focused on mount
    - Remove or update tests that asserted the old static headline "Your order is with the kitchen" as the only headline
  - [x] **DO NOT** mock `setInterval` / `clearInterval` directly — use `vi.useFakeTimers()` which handles both. The spy approach is for assertion ("was setInterval called?"), not for stubbing.
  - [x] **DO NOT** test the Realtime subscription path — there isn't one. Tests cover polling only.

- [ ] **Task 7 — Manual smoke test** (AC: #1–#9, also satisfies Stories 9.1 and 9.2 Done Gates)
  - [ ] Start local Supabase (`supabase start`) and the dev server (`npm run dev`).
  - [ ] Open a customer browser session at `/{slug}/{table}` (the menu QR URL).
  - [ ] Add an item to cart, place the order. Confirm the URL becomes `/{slug}/{table}/order/{order_id}`.
  - [ ] Confirm the page renders the orange "Confirmed" pill and the headline "Your order is with the kitchen" — SSR, no flash.
  - [ ] In a second browser window (or tab), sign in as the owner of that restaurant. Open `/admin/orders`. The new order should be in the Active tab with the orange dot.
  - [ ] In the admin tab, tap "Mark preparing". Within ~4 seconds, the customer tab's pill should turn blue + pulse, with headline "Your food is being prepared".
  - [ ] In the admin tab, tap "Mark ready". Within ~4 seconds, customer pill turns green, headline "Your order is ready".
  - [ ] In the admin tab, tap "Mark completed". Within ~4 seconds, customer pill turns muted grey, headline "Order completed — enjoy your meal".
  - [ ] Open browser devtools Network tab on the customer page; confirm that after the completed transition, no further requests to `orders_customer_status` are made (polling stopped).
  - [ ] **Reload-after-bookmark test:** Bookmark the order URL, close the tab, open the bookmark. The page should render with the current status (whatever the DB now says).
  - [ ] **Cross-table forgery test:** With the order_id from this test, try a URL with a different `table_number` (e.g., `/{slug}/2/order/{order_id}`). The page should show the 404 "This page isn't available" message — server-side tuple check rejects the mismatch.
  - [ ] **Cross-restaurant forgery test:** Try a URL with a different `restaurant_slug`. Same 404 result.
  - [ ] **Realtime / no-Realtime probe:** In devtools, confirm there is no `wss://` WebSocket connection opened by the customer order page (Realtime is not used here). Polling-only.
  - [ ] **Done Gate cascade:** This smoke test also satisfies Story 9.1's done-gate (`advanceOrderStatus` exercised end-to-end against a real DB with a real customer-side reader) AND Story 9.2's done-gate (admin inline status controls exercised end-to-end). Update the sprint-status for 9.1, 9.2, and 9.3 to `done` after this passes.

### Review Findings (2026-05-20)

Code review by Blind Hunter + Edge Case Hunter + Acceptance Auditor. 16 active findings (6 decisions, 7 patches, 3 deferred); 13 dismissed as noise/false-positives/by-design.

**Decisions resolved (2026-05-20):**
- [x] [Review][Decision] AC#3 vs Task 4 pill styling for `completed` — **resolved: keep current implementation** (Task 4 example: `bg-surface-overlay text-text-secondary opacity-60`). AC#3 text is the inconsistent side; Task 4's example is canonical.
- [x] [Review][Decision] Polling resilience on persistent network failure — **resolved: keep silent** (spec's "Do NOT surface a UI affordance" applies). No backoff, no stale-state banner.
- [x] [Review][Decision] Order row deleted upstream (PGRST116) — **resolved: keep silent**. Orders are not deleted in MVP flow; revisit if a delete flow is added.
- [x] [Review][Decision] Tab visibility / background polling — **resolved: keep always-on**. Matches admin polling fallback pattern; battery cost accepted.
- [x] [Review][Decision] `SubmitOrderData.id` vs `orderId` naming — **resolved: keep as `id`**. Spec contract honoured; ambiguity at call site is a minor nit.
- [x] [Review][Decision] Brief empty-cart UI flash — **resolved: convert to patch** (render null while `hasSubmittedRef.current === true`). See patches below.

**Patches (applied 2026-05-20):**
- [x] [Review][Patch] Cart page: return null while `hasSubmittedRef.current === true` to hide the empty-cart flash between `clearCart()` and `router.replace` settling [app/[restaurant_slug]/[table_number]/cart/page.tsx] — converted from Decision 6.
- [x] [Review][Patch] Destructure `error` on all 3 SSR queries + log on failure [app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx:26,33,41] — project-context.md rule violated; transient DB errors currently swallowed silently.
- [x] [Review][Patch] Guard `order.items` cast against null / non-array shape [app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx:60] — `(order.items as unknown as OrderItem[]).map()` throws if items is null/malformed (legacy or partial-write rows).
- [x] [Review][Patch] Validate `order.status` is a known `OrderStatus` before passing to client [app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx:57] — DB drift would produce undefined `HEADLINE[status]` etc.
- [x] [Review][Patch] Validate poll-response `data.status` is a known `OrderStatus` before `setStatus` [components/customer/OrderConfirmationScreen.tsx:88-90] — same DB-drift concern on the polling side.
- [x] [Review][Patch] Strict integer validation for `table_number` URL parameter [app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx:21] — `parseInt('3abc', 10)` returns 3; use `/^\d+$/` regex or `Number(...)` + `Number.isInteger`.
- [x] [Review][Patch] Add unit test asserting headline `tabIndex={-1}` element receives focus on mount [tests/unit/customer/OrderConfirmationScreen.test.tsx] — Task 6 explicitly listed this; missing.
- [x] [Review][Patch] Add unit test for poll-error path (silent return, no setStatus) [tests/unit/customer/OrderConfirmationScreen.test.tsx] — coverage hole for the most common production failure mode.

**Shared validator introduced:** `utils/orderStatus.ts` now exports `ORDER_STATUSES` (readonly tuple) and `isOrderStatus` (type-guard). Used by both the SSR page (validates `order.status` before passing to the client component) and the polling effect (validates the poll-response status before `setStatus`). Patch 4 + Patch 5 share this single guard.

**Deferred (pre-existing / out-of-scope):**
- [x] [Review][Defer] Task 7 manual smoke test pending — workflow-by-design; satisfies Done Gate for 9.1/9.2/9.3 after execution.
- [x] [Review][Defer] Admin-client throw not wrapped in try/catch on SSR page [app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx] — established pattern; menu page (`app/[restaurant_slug]/[table_number]/page.tsx`) does not try/catch either. Fix would be project-wide, not 9.3-scoped.
- [x] [Review][Defer] `submitOrder` lacks idempotency — duplicate orders possible if user retries after the (unreachable) "insert succeeded but row read failed" branch [actions/orderActions.ts:99-105]. Pre-existing concern in submitOrder; not introduced by 9.3.

---

## Dev Notes

### Why polling (not Realtime) for the customer side

Story 9.1's code-review (2026-05-20) dropped the permissive `customer_select_order_by_id` policy on `public.orders` and replaced it with a column-restricted view `orders_customer_status` (exposing `id, status` only) granted to the anon role. The reasoning: the original policy allowed any anon caller who knew (or guessed) a UUID to SELECT the full order row, including `items`, `total_cents`, `restaurant_id`, `table_id`, and `handled_at` — overly permissive even with UUID entropy as the implicit auth token.

Postgres Realtime's `postgres_changes` events subscribe to **tables in the `supabase_realtime` publication**, not views. After the 9.1 migration, the anon role's only path to read order state is the view, which Realtime cannot subscribe to directly. The Story 9.1 migration header (`supabase/migrations/20260520170000_replace_orders_customer_select_with_view.sql`) listed two paths for Story 9.3:

| Option | Mechanism | Tradeoff |
|---|---|---|
| **(A)** Re-add a column-limited policy on `public.orders` for anon | Postgres RLS + Realtime postgres_changes | RLS cannot restrict columns — anon would see the full row again, regressing the 9.1 security tightening |
| **(B)** Switch to Realtime broadcast OR polling on the view | Trigger function + broadcast OR plain `setInterval` HTTP poll | Polling is simpler, no schema changes, no Realtime auth dance for anon; max 4s latency satisfies FR54 (≤5s) |

**Story 9.3 chooses Option B with polling** (not broadcast). Polling is:
- Already a proven pattern in this codebase (admin polling fallback at 4000ms in `RealtimeProvider.tsx`)
- Schema-change-free
- Trivial to test deterministically with `vi.useFakeTimers()`
- Adequate for the 5s SLA (FR54)

Broadcast (Supabase Realtime channels with custom payloads) is deferred to a future story if perceived latency proves problematic. For dine-in customer UX, 4-second granularity on "your food is being prepared" → "ready" feels acceptable and matches industry norms.

### Why a new SSR route, not an inline confirmation render

The current cart page renders `OrderConfirmationScreen` inline after a successful `submitOrder`, with the order data carried in React state. This works for the immediate post-submit flow but breaks down for:
- **Reload after submit** — refreshing the cart page would lose the `confirmedOrder` state and redirect to the menu
- **Bookmarking** — a customer who screenshots or bookmarks the URL has no way to return to their order tracking
- **Multi-tab** — a customer who opens a fresh tab can't reach their order

Story 9.3's spec mandates URL-addressable order tracking (`order_id` in the URL). The cleanest implementation is a new SSR route under the existing customer namespace: `/{restaurant_slug}/{table_number}/order/{order_id}`. SSR fetches the current status server-side (no flash), and the client-side polling takes over for live updates.

The cart page becomes pure submission + navigation — no confirmation rendering. All confirmation/tracking UX lives in the new route's `OrderConfirmationScreen` component.

### URL design and back-button behavior

The new route slots into the existing customer URL tree:
- `/{slug}/{table}` → menu (current)
- `/{slug}/{table}/cart` → cart (current)
- `/{slug}/{table}/order/{order_id}` → order tracking (NEW)

The cart page uses `router.replace` (not `push`) to navigate after submit. This means:
- Back from order tracking → menu (skips the now-empty cart)
- Forward stack reset (no accidental re-submit if the user navigates back)

The QR code on the physical table still points to `/{slug}/{table}` (the menu). After a customer's order is complete, they can rescan the QR to start a fresh order — each order gets its own `order_id` URL.

### Security model recap

Anon's view grant (`GRANT SELECT ON orders_customer_status TO anon`) is intentionally permissive — any anon caller who knows an `order_id` UUID can read its `status`. UUID entropy (~10^36) serves as an implicit auth token for the status check.

**The security boundary is the SSR tuple validation** in the new order route page:
- Server resolves restaurant by `slug`
- Server resolves table by `(restaurant_id, number)`
- Server fetches order by `id` (via admin client — bypasses RLS, full row available)
- Server compares `order.restaurant_id === restaurant.id` AND `order.table_id === table.id`
- Mismatch → 404 (no leak)

This means a customer who guesses or steals a UUID still cannot read the full order details unless they also know the matching (slug, table_number). Even then, the order page only renders item names, table label, and status — no prices, no customer info (there is none — sessionless), no other tables' data.

The client-side polling uses the view (id + status only). A leaked URL gives away order status but never the items/total/etc. The trade-off was made and accepted in Story 9.1's code-review (memory `feedback_action_error_codes.md` covers the related action-side decision).

### Realtime UPDATE plumbing — admin vs customer asymmetry

After Story 9.3:

| Surface | Mechanism | Auth | Latency |
|---|---|---|---|
| `/admin/orders` (owner) | Realtime postgres_changes UPDATE | Owner JWT via cookie client + `realtime.setAuth()` | <500ms typical |
| `/admin/kds` (owner) | Realtime postgres_changes UPDATE | Same as above | <500ms typical |
| `/{slug}/{table}/order/{order_id}` (customer) | HTTP polling on view, 4000ms | Anon (no auth) | ≤4s |

This asymmetry is intentional. Owners benefit from sub-second updates (multiple operators coordinating in real-time). Customers need eventual consistency only — knowing within 4s that their food is ready is fine for the dine-in experience.

The `RealtimeProvider` component is admin-only and lives in `components/shared/` (named for backwards compatibility — it predates the customer/admin split). 9.3 does NOT use it on the customer side. The customer polling is inline in `OrderConfirmationScreen`'s `useEffect` — a separate hook (`useOrderStatusPolling`) is reasonable but adds an abstraction that has only one caller. Inline is the right call until a second caller appears.

### Headline copy variation

| Status | Headline | Subhead |
|---|---|---|
| received | "Your order is with the kitchen" | "Thank you! Sit tight while we prepare your food." |
| preparing | "Your food is being prepared" | "The kitchen is working on it." |
| ready | "Your order is ready" | "Please collect your order." |
| completed | "Order completed — enjoy your meal" | "We hope to see you again soon." |

Tone: warm, action-oriented, never anxiety-inducing. "Sit tight" is the existing copy and stays for the `received` state to preserve continuity with Phase-1 customers (Story 4.5 set the precedent). The pill label is the structured signal; the headline is the emotional layer.

The success checkmark icon is preserved across all 4 states — including `completed`. The "muted" visual treatment for completed comes from the pill style, not from removing the icon. Keeps the screen visually anchored.

### Anti-pattern reminders (from project-context + Stories 9.1/9.2 learnings)

| Anti-pattern | Correct pattern (this story) |
|---|---|
| `createClient()` from `lib/supabase/server.ts` on a customer page | `createAdminClient()` from `lib/supabase/admin.ts` (sessionless customer flow) |
| `postgres_changes` on `public.orders` from the anon role | HTTP poll the view `orders_customer_status` at 4000ms |
| `realtime.setAuth()` on the customer surface | N/A — customer has no session, no auth needed for view-level anon SELECT |
| `.select()` after admin-client INSERT in `submitOrder` | **Allowed** in `submitOrder` specifically (admin client bypasses 42501 RETURNING). Still forbidden for anon-context writes. |
| Hardcoded color hex on the pill (`#FF6B35` etc.) | `bg-accent`, `bg-info`, `bg-success`, `bg-text-secondary` (Story 9.2 tokens) |
| Imported `STATUS_DOT_CLASS` from `utils/orderStatus.ts` in the customer pill | Customer surface owns its own labels and pill classes (admin maps don't fit the customer's pill format) |
| `setTimeout` for polling | `setInterval` at 4000ms, cleared on unmount and on terminal-state transition |
| Showing a "Realtime unavailable" affordance to the customer | None — polling is the primary mechanism, never surfaced to UX |
| URL forgery (reading other tables' orders) | Server-side tuple check `order.restaurant_id === restaurant.id && order.table_id === table.id` |

### Files this story touches (NEW / UPDATE) vs. files it must NOT touch

**NEW in 9.3:**
- `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx` — SSR route with tuple validation

**UPDATE in 9.3:**
- `actions/orderActions.ts` — extend `submitOrder` to return `id`; extend `SubmitOrderData` interface
- `app/[restaurant_slug]/[table_number]/cart/page.tsx` — remove inline `OrderConfirmationScreen` render; navigate to new route after submit
- `components/customer/OrderConfirmationScreen.tsx` — accept `orderId` + `initialStatus`; render status pill; add polling effect
- `tests/unit/customer/OrderConfirmationScreen.test.tsx` — migrate to new props; add pill + polling tests
- `tests/unit/actions/orderActions.test.ts` — update `makeAdminClient` factory for the new `.insert().select('id').single()` chain; add a "submitOrder returns id" test

**MUST NOT touch in 9.3:**
- `supabase/migrations/*` — no schema change in 9.3. The view exists from 9.1.
- `types/supabase.ts` — auto-generated; no schema change.
- `types/app.ts` — `OrderStatus` and `Order` were added in 9.1; no change needed.
- `actions/orderActions.ts → advanceOrderStatus` — Story 9.1/9.2 contract is frozen.
- `actions/orderActions.ts → unbumpOrder` — Story 9.2 rewrite is frozen.
- `components/admin/*` — admin surface is 9.2 territory.
- `components/shared/RealtimeProvider.tsx` — admin-only; not used by the customer order page.
- `stores/cartStore.ts` — already has `clearCart()`; no change needed.
- `stores/orderStore.ts` — admin-only store; not used here.
- `tests/rls/order-status.spec.ts` — 9.1 already covers the anon view grant; no new RLS test needed for 9.3.

### Acceptance gate / Done Gate cascade

Story 9.1 was held at `review` pending a manual smoke test (memory `feedback_real_db_smoke_test.md`). Story 9.2 inherits the same gate. The Task 7 manual smoke in this story exercises:
- `advanceOrderStatus` end-to-end (covers 9.1's done gate — admin advances, customer sees update)
- Admin inline status controls end-to-end (covers 9.2's done gate — owner advances via OrderCard buttons)
- The new customer SSR + polling path (covers 9.3's own gate)

After Task 7 passes, all three stories can flip to `done` in sprint-status.yaml in a single sprint-status update.

### Open questions for future work (not blocking 9.3)

1. **Broadcast upgrade:** If 4s polling proves too slow in user research, swap to Supabase Realtime broadcast channels (`order:{orderId}` topic) with the existing `advanceOrderStatus` Server Action publishing on transition. This is a Phase-3 enhancement; the polling design accommodates the swap by isolating the subscription logic in one `useEffect`.
2. **Order history per table:** Customers currently have no list of past orders — only the URL of the most recent submission. A future story could add a "Your orders today" list using local storage (URL/UUID history) or a phone-number-bound session.
3. **Push notifications:** Web Push from the customer browser is out of scope; would require service worker + opt-in. Polling + a foregrounded tab is the only delivery channel today.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.3: Customer Order Tracking on Confirmation Screen]
- [Source: _bmad-output/planning-artifacts/prd.md#FR53, FR54]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Confirmation screen patterns] — closed-loop confirmation, full-screen, immediate
- [Source: _bmad-output/implementation-artifacts/9-1-order-status-data-model-server-action.md] — order status enum, `orders_customer_status` view, anon SELECT grant
- [Source: _bmad-output/implementation-artifacts/9-2-admin-ui-inline-status-controls.md] — design tokens (`info`), `advanceOrderStatus` contract, status label mappings
- [Source: supabase/migrations/20260520170000_replace_orders_customer_select_with_view.sql] — the explicit Realtime caveat that Story 9.3 resolves
- [Source: components/shared/RealtimeProvider.tsx] — admin pattern for polling fallback (4000ms); reference for the customer polling design
- [Source: app/[restaurant_slug]/[table_number]/page.tsx] — admin client + sequential resolve pattern that the new order route mirrors
- [Source: app/[restaurant_slug]/[table_number]/cart/page.tsx] — current inline confirmation render that this story replaces with navigation
- [Source: components/customer/OrderConfirmationScreen.tsx] — current pure-presentational component that this story extends with status + polling
- [Source: docs/conventions/supabase-clients.md] — admin vs server vs browser client rules
- [Memory: project_supabase_anon_role.md] — anon role behavior for sessionless customers
- [Memory: project_postgres_42501_returning.md] — why `.select()` after customer INSERTs is forbidden; `submitOrder`'s admin-client exception
- [Memory: feedback_real_db_smoke_test.md] — manual smoke required for customer-facing actions
- [Memory: feedback_action_error_codes.md] — `ActionResult.code` consumer-side rollback policy (informational; not actively used in 9.3)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

_No debug sessions required._

### Completion Notes List

- Task 1: Extended `submitOrder` with `.select('id').single()` chain (admin client — bypasses 42501 RETURNING trap). Removed the old "does not call .select()" test (tested old behavior); added "returns data.id" test. `makeAdminClient` factory updated to support the chained mock. 32/32 tests.
- Task 2: Removed inline `OrderConfirmationScreen` render from cart page. Added `hasSubmittedRef` to guard the empty-cart redirect effect from racing `router.replace`. `router.replace` now navigates to `/{slug}/{table}/order/{id}` on success. 19/19 tests.
- Task 3: Created `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx` — Server Component, admin client, sequential tuple validation, inline `OrderUnavailable` (mirrors `MenuUnavailable`). Uses `as unknown as OrderItem[]` cast to satisfy Supabase Json typing.
- Task 4+5: Rewrote `OrderConfirmationScreen` with `orderId`+`initialStatus` props, `status` state, four status maps (HEADLINE/SUBHEAD/PILL_LABEL/PILL_CLASS/DOT_CLASS), `role="status"` pill with `aria-live="polite"`, and 4000ms polling loop on `orders_customer_status` view. Polling skips on `completed` and clears on status change + unmount.
- Task 6: Rewrote test file — 23 tests across static rendering, pill, and polling. `vi.useFakeTimers()` for deterministic interval tests. Supabase client mock via closure delegation pattern (`pollSingleMock`). TypeScript cast `(pollSingleMock as (...a: unknown[]) => unknown)` required due to Vitest `Mock` callable type constraints.
- Full suite: 537/537 tests, no regressions.
- **Code review (2026-05-20):** 6 decisions resolved (5 kept current behavior, 1 converted to patch), 8 patches applied, 3 deferred, 13 dismissed. Introduced `isOrderStatus`/`ORDER_STATUSES` in `utils/orderStatus.ts` as shared runtime validator; used by SSR page + polling effect. Cart page now returns null whenever `hasSubmittedRef.current` is true (hides post-submit flash). SSR page now destructures `error` on all three queries, logs failures, strict `/^\d+$/` validation for `table_number`, `isOrderStatus` guard on `order.status`, and `Array.isArray` guards on `order.items` + `it.variants`. OrderConfirmationScreen poll handler uses `isOrderStatus` before `setStatus`. Three new tests: headline focus on mount, poll-error silent path, poll invalid-status ignored. 540/540 tests.

### File List

- `actions/orderActions.ts` — UPDATE: added `id` to `SubmitOrderData`; chained `.select('id').single()` after admin-client INSERT; defensive no-row check
- `app/[restaurant_slug]/[table_number]/cart/page.tsx` — UPDATE: removed inline `OrderConfirmationScreen` render + `ConfirmedOrderState`; added `hasSubmittedRef`; success path navigates to order tracking URL. **Review patch:** early-return guard widened to return null whenever `hasSubmittedRef.current` is true (hides empty-cart flash).
- `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx` — NEW: SSR order tracking route with tuple validation and `OrderUnavailable` component. **Review patches:** strict `/^\d+$/` table_number validation; `error` destructured + `console.error` logged on all 3 queries; `isOrderStatus` guard on `order.status`; `Array.isArray` guards on `order.items` + `it.variants`.
- `components/customer/OrderConfirmationScreen.tsx` — UPDATE: new props (`orderId`, `initialStatus`), `status` state, status-driven headline/subhead/pill, 4000ms polling on `orders_customer_status`. **Review patch:** poll handler now uses `isOrderStatus` guard before `setStatus`.
- `utils/orderStatus.ts` — UPDATE: added `ORDER_STATUSES` readonly tuple and `isOrderStatus` type-guard (used by SSR page + polling effect). **Review patch.**
- `tests/unit/actions/orderActions.test.ts` — UPDATE: `makeAdminClient` chain extended; "does not call .select()" test removed; "returns data.id" test added
- `tests/unit/customer/CartPage.test.tsx` — UPDATE: "navigates to order tracking route" replaces "OrderConfirmationScreen renders"; success mock includes `id`
- `tests/unit/customer/OrderConfirmationScreen.test.tsx` — UPDATE: full rewrite with new props + Supabase mock + fake timer polling tests (23 tests). **Review patches:** added 3 tests — headline focus on mount, poll-error silent, poll invalid-status ignored (26 tests total).
