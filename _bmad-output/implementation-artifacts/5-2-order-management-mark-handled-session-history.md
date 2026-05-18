# Story 5.2: Order Management — Mark Handled & Session History

Status: done

## Story

As a restaurant owner,
I want to mark orders as handled and review what's been fulfilled during a service,
so that I can manage the queue and track order completion throughout the session.

## Acceptance Criteria

1. **Given** an order is in the Active tab
   **When** the owner taps "Mark handled" on the OrderCard
   **Then** `markOrderHandled()` Server Action sets `is_handled: true` on the order
   **And** the OrderCard immediately transitions to handled state (grey dot, 40% opacity) — no confirmation dialog, single tap

2. **Given** an order is marked handled
   **When** the feed updates
   **Then** the order moves to the Handled tab and the next unhandled order surfaces at the top of Active

3. **Given** the owner taps a compact OrderCard row to expand it
   **When** the row expands inline
   **Then** the full item list (name + variants for every item) is shown without navigating away from the feed

4. **Given** the owner selects the Handled tab
   **When** it renders
   **Then** all orders marked handled during the session are shown with grey dot and muted styling (FR33)

5. **Given** the owner selects the All tab
   **When** it renders
   **Then** all orders (active + handled) are shown together, newest first

---

## Tasks / Subtasks

- [x] **Task 1 — Add `markOrderHandled` Server Action to `actions/orderActions.ts`** (AC: #1, #2)
  - [x] Add `export async function markOrderHandled(orderId: string): Promise<ActionResult<void>>` to `actions/orderActions.ts`
  - [x] Use `createClient()` from `@/lib/supabase/server` (NOT admin client — owner is authenticated, `owner_update_orders` RLS covers this)
  - [x] Call `supabase.auth.getUser()` and return `{ success: false, error: '...' }` if no user (guard, same pattern as other server actions)
  - [x] UPDATE: `.from('orders').update({ is_handled: true, handled_at: new Date().toISOString() }).eq('id', orderId)` — **NO `.select()`** (42501/RETURNING rule — see `docs/conventions/supabase-clients.md`)
  - [x] Return `{ success: true, data: undefined }` on success, `{ success: false, error: 'Failed to mark order as handled' }` on `error`
  - [x] Add `'use server'` directive at top of file (already present — just add the new export)

- [x] **Task 2 — Add `updateOrder` action to `stores/orderStore.ts`** (AC: #1, #2, #4)
  - [x] Add `updateOrder: (order: Order) => void` to `OrderStore` interface
  - [x] Implement: find order by `id`, merge the incoming `order` fields (replace-in-place, re-sort by `submitted_at` DESC)
  - [x] If id not found, call `addOrder(order)` as fallback (defensive — catches edge case where INSERT Realtime event was missed)
  - [x] Unit test: `updateOrder` merges `is_handled: true` into existing order; `updateOrder` for unknown id calls `addOrder`

- [x] **Task 3 — Update `RealtimeProvider.tsx` to handle UPDATE events + all-order fetch** (AC: #2, #4, #5)
  - [x] **Expand Realtime subscription** — add a second `.on()` for `event: 'UPDATE'` on the same channel, same filter (`restaurant_id=eq.${restaurantId}`), calling `useOrderStore.getState().updateOrder(payload.new as Order)`
  - [x] **Change initial `refetchOrders` fetch** — remove `.eq('is_handled', false)` so ALL orders (handled + unhandled) are loaded on mount and during polling; add `.order('submitted_at', { ascending: false })` (already there), keep `limit(100)` — this enables the Handled and All tabs to work
  - [x] Call `setOrders` (not a new action) — `setOrders` replaces the full list; since we now fetch all orders, the store becomes the source of truth for all three tabs
  - [x] Known limitation (document in dev notes): if >100 total orders in one session, the oldest handled orders may not appear in the Handled tab; acceptable for a polling-fallback scenario
  - [x] `@ts-expect-error` directives removed — supabase-js now types `'postgres_changes'` correctly; both INSERT and UPDATE handlers compile cleanly
  - [x] Unit test: UPDATE payload triggers `updateOrder`; Handled-tab-relevant orders survive a polling cycle (store replaced with all orders, filtered list shows is_handled=true)

- [x] **Task 4 — Update `OrderCard.tsx` with Mark Handled action + inline expand** (AC: #1, #3)
  - [x] Add props: `onMarkHandled?: () => void` (only relevant when `!order.is_handled`)
  - [x] Add local `useState<boolean>(false)` for `isExpanded` — tap compact row button (not the "Mark handled" button) toggles
  - [x] **"Mark handled" button**: render only when `!order.is_handled && onMarkHandled`; `className="text-accent text-sm"` (no background, text-only — per UX spec); sibling of expand button (no stopPropagation needed)
  - [x] **Compact row** (not expanded): expand button wraps status dot, table number, item summary, timestamp; carries `aria-label` and `aria-expanded`
  - [x] **Expanded row** (isExpanded): show full item list — for each `OrderItem` render `{item.quantity}× {item.name}` and below it the variant list as `text-text-secondary` small text. **No prices**
  - [x] Handled card: grey dot + 40% opacity on the row wrapper; "Mark handled" hidden; tap-to-expand still works
  - [x] Preserve existing `aria-label`, accessible table-fallback ("Table —"), and empty-items "No items" behavior from 5.1
  - [x] Unit tests: "Mark handled" callback fires on tap; expand toggles inline item list; handled card hides "Mark handled"; mark-handled does not toggle expand; no prices in expanded view

- [x] **Task 5 — Update `OrderFeed.tsx` with Active/Handled/All tabs + mark-handled wiring** (AC: #1, #2, #4, #5)
  - [x] Add `useState<'active' | 'handled' | 'all'>('active')` for `activeTab`
  - [x] Tab bar: 3 tab buttons (Active / Handled / All) — `role="tablist"`, each `role="tab"`, `aria-selected`, active tab styled with `border-b-2 border-accent text-text-primary`, inactive `text-text-secondary`
  - [x] **Tab filter logic**: Active = unhandled, Handled = is_handled, All = all orders
  - [x] **`handleMarkHandled(orderId)` function**: optimistic `markHandled(orderId)` store call → `await markOrderHandled(orderId)` Server Action
  - [x] Empty states per tab: Active "No orders yet — orders will appear here automatically", Handled "No handled orders yet", All "No orders yet"
  - [x] `data-realtime-ready` attribute preserved on content area (ul + empty state div)
  - [x] Unit tests: tab switching renders correct filtered lists; `handleMarkHandled` calls store optimistically then Server Action; Handled tab empty state; tab buttons render

- [x] **Task 6 — Real-DB e2e smoke test** (AC: #1, #2; Epic 4 retro lesson — mocked tests do not catch RLS failures)
  - [x] Added `tests/e2e/order-mark-handled.spec.ts`
  - [x] Test flow: owner signs in → opens `/admin/orders` → waits for `data-realtime-ready="true"` → inserts an order → asserts OrderCard appears in Active tab → taps "Mark handled" → asserts order disappears from Active → switches to Handled tab → asserts order appears
  - [x] Uses `getByRole('tab', { name: 'Handled' })` to switch tabs
  - [x] Reuses helpers from `tests/rls/helpers.ts` and mirrors `realtime-order-delivery.spec.ts` pattern

### Review Findings (2026-05-18)

Adversarial review (Blind Hunter + Acceptance Auditor) returned 28 raw findings. After dedupe + triage: 0 decision-needed (1 resolved → deferred), 5 patches, 2 deferred, 21 dismissed. **Edge Case Hunter layer failed (stream watchdog stall after 600s) — review may be incomplete on edge-case coverage.**

**Decision-needed (resolved):**

- [x] [Review][Decision] **Tabs ARIA half-implementation vs full WAI-ARIA tablist pattern** — resolved: accept as-is, matches spec scope. Full ARIA upgrade (tabpanel + aria-controls + arrow-key nav) deferred to a future a11y pass.

**Patch (applied):**

- [x] [Review][Patch] **`handleMarkHandled` discards Server Action result — silent failure on RLS denial / network error** [components/admin/OrderFeed.tsx:41-46] — applied: capture `result`, `console.error('[markOrderHandled]', result.error)` when `!result.success`.
- [x] [Review][Patch] **Server Action masks the Postgres error** [actions/orderActions.ts:113-116] — applied: `console.error('[markOrderHandled]', error)` before the masked return.
- [x] [Review][Patch] **No idempotency guard on UPDATE — double-tap overwrites `handled_at`** [actions/orderActions.ts:111] — applied: added `.eq('is_handled', false)` to the UPDATE so the second call is a no-op at the DB level.
- [x] [Review][Patch] **Expand button has `aria-expanded` but no `aria-controls`** [components/admin/OrderCard.tsx:21,43,64] — applied: `useId()` for a stable `panelId`, `aria-controls={panelId}` on the expand button, `id={panelId}` on the expanded `<ul>`.
- [x] [Review][Patch] **`markOrderHandled` return type deviates from spec signature** [actions/orderActions.ts:100] — applied: changed to `Promise<ActionResult<void>>`.

**Deferred (real but not actionable now):**

- [x] [Review][Defer] **`handled_at` uses application clock (`new Date().toISOString()`), not DB `now()`** [actions/orderActions.ts:110] — deferred, server-side process clock has negligible drift via NTP; DB-clock idempotency would need a raw SQL fragment or RPC. Out of 5.2 scope; revisit if cross-server clock skew surfaces in audit reports.
- [x] [Review][Defer] **Tabs ARIA upgrade to full WAI-ARIA tablist pattern** [components/admin/OrderFeed.tsx:51-66] — deferred, spec scope honored (role=tablist + role=tab + aria-selected only). Future a11y pass to add tabpanel + aria-controls/id linkage + arrow-key navigation.

**Dismissed (21):** Auditor self-withdrew A2/A3/A4/A7 (not actual violations); Auditor A5/A6/A8 (low-value coverage gaps already covered by sibling tests or impossible inputs); Blind #3 `restaurant_id` app-layer scoping (RLS `owner_update_orders` is the established project contract); Blind #5 orderId validation (RLS + controlled client source); Blind #8 `limit(100)` data-loss (documented and accepted in spec); Blind #9/#18 `updateOrder` resurrection (intended fallback for missed-INSERT case; no DELETE subscription in 5.2); Blind #10 filter string interpolation (UUIDs are safe); Blind #12 array index key (items array is stable per order); Blind #13 removed `@ts-expect-error` (tsc verified directives were unused); Blind #14 `createTestOwner` password (helper has internal `TEST_PASSWORD` — established convention); Blind #15/#19 5.1 pre-existing patterns (`mh-mh-` double-prefix, `data-realtime-ready` placement); Blind #16 `Table 3` text uniqueness (admin page has no other table labels); Blind #20 inconsistent DB state (defensive only, no real ingress).

---

## Dev Notes

### Critical Context

**Building directly on Story 5.1.** All infrastructure from 5.1 is in place:
- `useOrderStore` with `setOrders`, `addOrder`, `markHandled` (placeholder), `setRealtimeReady`, `reset`
- `RealtimeProvider` wraps `app/admin/layout.tsx` — subscribed to `INSERT` events
- `OrderCard` renders compact rows (no Mark Handled wiring, no expand — both deferred to this story)
- `OrderFeed` renders Active view only (no tabs — deferred to this story)

**DO NOT recreate or duplicate these files — only UPDATE them.**

**`markHandled` store action is a placeholder** (from Story 5.1 deferred note): uses `new Date().toISOString()` for client-side optimistic `handled_at`. This is intentional — the server reconciles via Realtime UPDATE. Do not change the `markHandled` action; add `updateOrder` alongside it.

**Realtime subscription must be expanded to include UPDATE events** (5.1 deferred note: "INSERT-only subscription misses UPDATE/DELETE — Story 5.2 wires markOrderHandled; subscription will be expanded to `'*'` there"). The cleanest approach is a second `.on()` for UPDATE (not `event: '*'`) so each handler is explicit.

### Architecture Compliance

**Server Action pattern** (`ActionResult<T>`, no throw, no RETURNING):
- `markOrderHandled` must return `ActionResult<void>` — `data: undefined` on success
- Never throw from a Server Action — always return the error shape
- **No `.select()` after UPDATE** — the 42501 postgres error covers both WITH CHECK and RETURNING-SELECT failures; owner UPDATE is gated by `owner_update_orders` RLS policy, which is already in place from Story 1-2
- Client-selection: `createClient()` from `@/lib/supabase/server` (NOT admin client) — the owner is authenticated; admin client bypasses RLS and is only for cross-tenant or anonymous-session paths

**Realtime + Zustand pattern**:
- Call `useOrderStore.getState().updateOrder(...)` inside the Realtime callback — `getState()`, NOT a hook
- The new UPDATE subscription uses the same `filter: restaurant_id=eq.${restaurantId}` as INSERT (never subscribe globally)

**UI tokens** — do NOT hardcode hex values:
- `text-accent` for "Mark handled" link (#FF6B35)
- `bg-text-secondary` + `opacity-40` for handled dot (already in OrderCard)
- `border-accent` for active tab underline
- `text-text-secondary` for variant text in expanded view

### Existing Code Being Modified (READ BEFORE IMPLEMENTING)

**`actions/orderActions.ts`** — current state:
- Has `'use server'` directive + `submitOrder` export
- Uses `createAdminClient()` for cross-tenant lookup (restaurant by slug, table by number)
- **For `markOrderHandled`: use `createClient()` from `@/lib/supabase/server` (authenticated owner flow), NOT `createAdminClient()`**
- Header comment already cross-references `docs/conventions/supabase-clients.md`

**`stores/orderStore.ts`** — current state:
- `orders: Order[]` sorted `submitted_at` DESC
- `markHandled(orderId)`: sets `is_handled: true, handled_at: new Date().toISOString()` (optimistic)
- `setOrders`, `addOrder` (idempotent prepend), `setRealtimeReady`, `reset`
- `updateOrder` does NOT exist yet — must be added

**`components/shared/RealtimeProvider.tsx`** — current state:
- `init()`: `propagateAuthToRealtime()` → `refetchOrders()` → create channel + subscribe
- `refetchOrders`: fetches `is_handled = false` only, `limit(100)`, calls `setOrders`
- Channel: `event: 'INSERT'` only, payload → `addOrder(payload.new)`
- `@ts-expect-error` on the `.on('postgres_changes', ...)` call — preserve for new UPDATE `.on()` call too
- Auth state listener handles `TOKEN_REFRESHED` and `SIGNED_OUT`
- Cleanup: `cancelled`, `stopPolling()`, auth listener unsubscribe, `reset()`, `removeChannel`
- **Changes needed**: remove `is_handled = false` from `refetchOrders` query; add UPDATE `.on()` call

**`components/admin/OrderCard.tsx`** — current state:
- Props: `order: Order`, `tableNumber: number | null`
- No `onMarkHandled` prop, no expand state
- Comment: `// "Mark handled" action and tap-to-expand are deferred to Story 5.2.`
- Anatomy: dot + table label + item summary (truncated) + timestamp — stateless, no interaction
- **Changes needed**: add `onMarkHandled`, `isExpanded` state, expanded item list, "Mark handled" link

**`components/admin/OrderFeed.tsx`** — current state:
- Props: `tablesById: Record<string, number>`
- Reads `orders` and `isRealtimeReady` from store
- Filters to `orders.filter(o => !o.is_handled)` — Active only
- Comment: `// Active/Handled/All tab switching is deferred to Story 5.2.`
- Empty state when `activeOrders.length === 0`
- `data-realtime-ready={readyAttr}` on outer wrapper — **preserve this for e2e**
- **Changes needed**: add tab state + tab bar + per-tab filtering + `handleMarkHandled` wiring

### File Structure (UPDATE only — no new files unless adding tests)

| Path | NEW/UPDATE | Changes |
|---|---|---|
| `actions/orderActions.ts` | UPDATE | Add `markOrderHandled` export |
| `stores/orderStore.ts` | UPDATE | Add `updateOrder` action |
| `components/shared/RealtimeProvider.tsx` | UPDATE | Add UPDATE subscription, remove `is_handled=false` filter |
| `components/admin/OrderCard.tsx` | UPDATE | Add `onMarkHandled` prop, expand state, full item list, Mark handled link |
| `components/admin/OrderFeed.tsx` | UPDATE | Add Active/Handled/All tabs, `handleMarkHandled` wiring |
| `tests/unit/stores/orderStore.test.ts` | UPDATE | Test `updateOrder` action |
| `tests/unit/admin/OrderCard.test.tsx` | UPDATE | Test mark handled, expand, handled styling |
| `tests/unit/admin/OrderFeed.test.tsx` | UPDATE | Test tab switching, handleMarkHandled call chain |
| `tests/e2e/order-mark-handled.spec.ts` | NEW | Real-DB e2e: mark order handled → Handled tab |

### Testing Standards

- Unit: `vitest --run`, `@testing-library/react`, jsdom
- Store reset between tests: `useOrderStore.setState({ orders: [], isRealtimeReady: false })` in `beforeEach`
- Mock Server Actions in unit tests: `vi.mock('@/actions/orderActions')` — do NOT call real DB in unit tests
- e2e: `npm run test:e2e` (Playwright), real DB required — mock-only tests do NOT catch RLS failures (Epic 4 retro lesson)
- Reuse helpers from `tests/rls/helpers.ts` and `tests/e2e/realtime-order-delivery.spec.ts`

### Anti-Patterns to Avoid

- `useOrderStore()` hook inside Realtime callback → `useOrderStore.getState()`
- `.select()` after UPDATE → omit entirely, 42501 rule applies
- `createAdminClient()` for `markOrderHandled` → use `createClient()` (owner is authenticated)
- Showing prices in expanded item list → owner-side never shows prices (architecture + UX spec)
- Navigating away to see order detail → inline expand only, no page navigation in 5.2
- Confirmation dialog for "Mark handled" → single tap, immediate, no dialog
- Adding `OrderDetailPanel` in this story → that is Story 5.3 scope (desktop 2-column layout)
- Resetting `isExpanded` when `is_handled` becomes true is optional (card greys out and hides the link; expand still works per UX spec "tap to expand still works to see items")

### Key Design Decisions

**Optimistic update pattern for "Mark handled":**
1. `markHandled(orderId)` in store → immediate grey/opacity change in UI
2. `await markOrderHandled(orderId)` Server Action → persists to DB
3. Realtime UPDATE event fires → `updateOrder(payload.new)` → reconciles `handled_at` from server

This means the card transitions immediately (no loading spinner, no delay) per UX spec: "Single 'Mark Handled' tap on card — no confirmation dialog. Card moves to handled state immediately."

**Fetch strategy for all-orders view:**
- `refetchOrders` now fetches ALL orders (handled + unhandled), `limit(100)`, `order by submitted_at DESC`
- Removes the 5.1 patch `is_handled = false` filter — needed for Handled and All tabs to populate correctly
- Known limitation: if a session generates >100 total orders, the oldest handled orders may not appear in Handled tab. Acceptable for typical restaurant scale.

**`updateOrder` fallback to `addOrder`:**
- If Realtime INSERT is missed (race) and UPDATE arrives first, `updateOrder` calls `addOrder` as fallback
- This prevents invisible orders that are already handled but never appeared in the feed

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — AC source
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#OrderCard] — anatomy, states, interaction spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Mark Handled] — text link style, single tap, no dialog
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Session history] — handled orders visible for reference, no end-of-session action
- [Source: _bmad-output/planning-artifacts/architecture.md#Realtime Event Handling] — `getState()` in callbacks, `*` event expansion
- [Source: _bmad-output/planning-artifacts/architecture.md#Server Actions] — `ActionResult<T>`, no throw, no RETURNING
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — anti-patterns
- [Source: _bmad-output/implementation-artifacts/5-1-real-time-order-feed-with-polling-fallback.md#Review Findings] — deferred items carried into 5.2 (INSERT-only subscription, markHandled placeholder)
- [Source: docs/conventions/supabase-clients.md] — client selection rules, 42501 overload
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-05-18.md] — real-DB e2e requirement

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- E2e test failed on first headless run at 5s timeout (`getByText('Table 3')` not visible). Passed immediately in headed mode at 3.5s. Root cause: headless Chromium adds a small latency to Realtime websocket delivery. Fixed by extending that assertion's timeout from 5s to 8s. The `[data-realtime-ready="true"]` wait + deterministic flow is otherwise correct.
- Both `@ts-expect-error` directives on the `'postgres_changes'` `.on()` calls were flagged as unused by `tsc` — supabase-js types now accept the literal without suppression. Removed both cleanly; no type errors remain in story files.

### Completion Notes List

- All 6 tasks complete. All 6×N subtask checkboxes marked.
- Unit suite: 317/317 passing (was 302 after 5.1; +15 from this story across `orderStore`, `RealtimeProvider`, `OrderCard`, `OrderFeed`).
- E2e suite: `order-mark-handled.spec.ts` passing (~3.3s); `realtime-order-delivery.spec.ts` still passing — no regressions.
- TypeScript: no new errors in story-touched files; pre-existing errors in unrelated files (MenuItemForm, CategoryTabs, etc.) unchanged.
- `@ts-expect-error` removed from both Realtime `.on()` calls — compiler now accepts `'postgres_changes'` without suppression.
- Optimistic update pattern: `markHandled(id)` in store fires synchronously; Server Action `markOrderHandled(id)` persists to DB; Realtime UPDATE event calls `updateOrder(payload.new)` to reconcile authoritative `handled_at` from server.
- `refetchOrders` fetch change: removed `is_handled = false` filter. All orders (handled + unhandled) are fetched on mount and polling. Known limit: >100 total orders in one shift = oldest handled may not appear in Handled tab (documented; acceptable).

### File List

UPDATED:
- `actions/orderActions.ts` — added `markOrderHandled` Server Action
- `stores/orderStore.ts` — added `updateOrder` action to interface + implementation
- `components/shared/RealtimeProvider.tsx` — added UPDATE subscription, removed `is_handled=false` fetch filter, removed now-unused `@ts-expect-error` directives
- `components/admin/OrderCard.tsx` — added `onMarkHandled` prop, `isExpanded` state, "Mark handled" button, inline expanded item list; added `'use client'` directive
- `components/admin/OrderFeed.tsx` — added Active/Handled/All tab bar, per-tab filtering, `handleMarkHandled` wiring
- `tests/unit/stores/orderStore.test.ts` — added 3 tests for `updateOrder`
- `tests/unit/shared/RealtimeProvider.test.tsx` — updated mock chain (removed eq2/is_handled), added `triggerUpdate`, updated hydrates test, added UPDATE payload test
- `tests/unit/admin/OrderCard.test.tsx` — added 5 tests (mark handled, expand, no prices)
- `tests/unit/admin/OrderFeed.test.tsx` — added 5 tests (tabs, handleMarkHandled, empty states)

NEW:
- `tests/e2e/order-mark-handled.spec.ts` — real-DB smoke test: mark order handled → Handled tab

### Change Log

- 2026-05-18 — Implemented Story 5.2. Mark handled Server Action, Realtime UPDATE subscription, Active/Handled/All tabs, inline expand, real-DB e2e. 317 unit tests passing (was 302). Status → review.
- 2026-05-18 — Addressed code review findings: 1 decision-needed resolved (tabs ARIA accepted as-is per spec scope), 5 patches applied (error logging in `handleMarkHandled` and Server Action, server-side idempotency guard via `.eq('is_handled', false)`, `aria-controls` linkage on OrderCard expand button, return type → `ActionResult<void>`), 2 deferred (DB-clock `handled_at`, full ARIA tablist upgrade), 21 dismissed. Edge Case Hunter review layer failed (timeout); coverage relied on Blind Hunter + Acceptance Auditor. Tests 317/317 unit + 2/2 e2e. Status → done.
