# Story 5.1: Real-Time Order Feed with Polling Fallback

Status: done

## Story

As a restaurant owner,
I want new customer orders to appear in my Admin UI automatically during service without any page refresh,
so that I never miss an order and can manage the service floor without paper tickets.

## Acceptance Criteria

1. **Given** an authenticated owner has `/admin/orders` open
   **When** a customer submits an order
   **Then** the OrderCard appears at the top of the Active tab within 5 seconds — no refresh required (FR34, FR35, NFR2)

2. **Given** the Admin UI layout mounts at `app/admin/layout.tsx`
   **When** the Client Component renders
   **Then** a single global Supabase Realtime subscription is established for `orders` filtered by `restaurant_id=eq.{restaurantId}`
   **And** new INSERT events call `useOrderStore.getState().addOrder()` — direct store access, not a hook, to work inside the Realtime callback

3. **Given** Supabase Realtime is unavailable
   **When** the subscription fails or drops
   **Then** a `setInterval` polling fallback at 4000ms activates silently — no user-visible error or indicator
   **And** the interval is cleared when Realtime reconnects (NFR13)

4. **Given** the order feed renders on mobile
   **When** the Active tab displays
   **Then** orders appear as compact OrderCard rows: 8px orange status dot, bold table number, item summary (first 2 items + "+N more"), relative timestamp (relative up to 60 min, then absolute) — dark mode `#000000` background (Direction B)

5. **Given** the Active tab has no unhandled orders
   **When** it renders
   **Then** the empty state shows "No orders yet — orders will appear here automatically" — no refresh prompt

6. **Given** the feed first loads
   **When** the skeleton displays
   **Then** 3 compact row placeholders with dot + text lines appear and are replaced without layout shift

---

## Tasks / Subtasks

- [x] **Task 1 — Add `Order` domain type + Zustand `useOrderStore`** (AC: #2, #4)
  - [x] Add `Order` and `OrderItem` interfaces to `types/app.ts` (match the `orders.items` jsonb shape produced by `submitOrder`: `{ name, quantity, variants: string[] }`)
  - [x] Create `stores/orderStore.ts` mirroring `cartStore.ts` pattern: state `orders: Order[]` (sorted by `submitted_at` DESC); actions `setOrders(orders)`, `addOrder(order)` (idempotent on `id`, prepends), `markHandled(orderId)` (stubbed for 5.2 use — set placeholder updating `is_handled`)
  - [x] Unit test: `setOrders` replaces list, `addOrder` prepends + dedupes by `id`, store resets between tests

- [x] **Task 2 — Add `utils/formatTime.ts`** (AC: #4)
  - [x] Pure function `formatRelativeTime(iso: string, now?: Date): string` → returns `"just now"`, `"3m ago"`, `"45m ago"` for ≤60 min; absolute `"2:14 PM"` (locale time) for >60 min
  - [x] Unit test: each branch (just now <1min, minutes, >60min absolute)

- [x] **Task 3 — Create `components/shared/RealtimeProvider.tsx`** (AC: #2, #3)
  - [x] Client Component (`'use client'`), receives `restaurantId: string` and `children: React.ReactNode`
  - [x] On mount: hydrate `useOrderStore` via browser `createClient()` SELECT (orders where `restaurant_id = restaurantId`, order by `submitted_at` DESC, limit 100) → `setOrders(...)`
  - [x] Subscribe to `supabase.channel('orders-{restaurantId}').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: \`restaurant_id=eq.${restaurantId}\` }, payload => useOrderStore.getState().addOrder(payload.new as Order))`
  - [x] Track subscription status: if `subscribe(callback)` reports `'CLOSED'`, `'CHANNEL_ERROR'`, or `'TIMED_OUT'` → start `setInterval(refetchOrders, 4000)`
  - [x] On `'SUBSCRIBED'` after recovery → clear interval; on unmount → unsubscribe channel + clear interval
  - [x] Renders `{children}` only — no UI of its own
  - [x] Unit test (jsdom + mock supabase channel): hydrate sets orders; INSERT payload triggers `addOrder`; `'CHANNEL_ERROR'` start polling; reconnect stops polling; unmount cleans up

- [x] **Task 4 — Wire `RealtimeProvider` in `app/admin/layout.tsx`** (AC: #2)
  - [x] Preserve existing auth + restaurant_id guard (Server Component)
  - [x] Pass resolved `restaurantId` into `<RealtimeProvider restaurantId={profile.restaurant_id}>` as the wrapper around `{children}` (kept inside the existing `<div>` with `AdminNav`)
  - [x] Do NOT move the auth check into the client — keep it on the server side as today

- [x] **Task 5 — Create `components/admin/OrderCard.tsx`** (AC: #4)
  - [x] Props: `order: Order`, `tableNumber: number`
  - [x] Anatomy: 8px round status dot (orange `bg-accent` if `!order.is_handled`, grey `bg-text-secondary` + 40% opacity if handled), bold table number ("Table {n}"), item summary (`itemSummary(order.items)` → first 2 item names joined by ", " then `" +{N} more"` if >2), relative timestamp from `formatRelativeTime(order.submitted_at)`
  - [x] Wrapping `<article role="article" aria-label="Order for Table {n}, {items}, {time}">`
  - [x] No "Mark handled" action wiring in this story (that's 5.2) — render the text "Mark handled" link as a placeholder `<button type="button" disabled>` for now? **NO — omit the action entirely** to avoid wiring half a feature. Add a TODO comment referencing Story 5.2.
  - [x] Tap to expand inline is also 5.2 scope — render as a non-expandable compact row only
  - [x] Unit tests: renders table number, item summary truncation ("first 2 + +N more"), aria-label includes table + items + time, active vs handled visual states

- [x] **Task 6 — Create `components/admin/OrderFeed.tsx`** (AC: #1, #4, #5)
  - [x] Client Component (`'use client'`)
  - [x] Subscribe to `useOrderStore((s) => s.orders)`
  - [x] Filter to `orders.filter(o => !o.is_handled)` for the Active view (only view shown in 5.1)
  - [x] Resolve `tableNumber` per order: accept a `tablesById: Record<string, number>` prop passed from the Server Component page (avoids a per-row fetch)
  - [x] When the filtered list is empty: render the empty state copy "No orders yet — orders will appear here automatically"
  - [x] Otherwise: render a list of `<OrderCard>` rows
  - [x] Tab bar (Active / Handled / All) is **out of scope for 5.1** — render only the Active view. Tabs are added in 5.2.
  - [x] Unit tests: renders one card per unhandled order, empty state when no unhandled orders, sorts by `submitted_at` DESC, addOrder via store prepends new card

- [x] **Task 7 — Create `app/admin/orders/page.tsx` + `loading.tsx`** (AC: #1, #5, #6)
  - [x] `page.tsx` Server Component:
    - Fetch `profile.restaurant_id` (same pattern as `app/admin/layout.tsx`)
    - Fetch `tables` for that restaurant (id, number) → `tablesById` lookup map
    - Render `<OrderFeed tablesById={tablesById} />` — orders themselves come from `useOrderStore` populated by `RealtimeProvider` (no SSR of orders)
    - **DO NOT** also SSR orders — that would race with the store hydration. Hydration happens in `RealtimeProvider`.
  - [x] `loading.tsx` Server Component: 3 compact row placeholders matching `OrderCard` layout (dot + text lines, dark background, no layout shift when real cards swap in)

- [x] **Task 8 — Add "Orders" tab to `components/admin/AdminNav.tsx`** (housekeeping)
  - [x] Insert Orders tab between Dashboard and Menu: `{ href: '/admin/orders', label: 'Orders', icon: <pick-an-existing-or-similar-lucide-icon>, exact: false }`
  - [x] Verify mobile bottom bar wraps cleanly with 5 tabs; if cramped, abbreviate labels per existing pattern
  - [x] No unit test changes required beyond AdminNav's existing tab rendering test if one exists

- [x] **Task 9 — Real-DB e2e smoke test** (AC: #1; retrospective action A1)
  - [x] Add `tests/e2e/realtime-order-delivery.spec.ts` — Playwright test that:
    - Signs in a test owner (use `tests/rls/helpers.ts` if reusable; otherwise create a focused helper)
    - Opens `/admin/orders` in one browser context
    - In a separate context, inserts an order via the customer flow OR via direct authenticated DB call simulating `submitOrder`'s row
    - Asserts the OrderCard appears in the owner's feed within 5 seconds
  - [x] **This is a hard prerequisite for marking the story done.** Mocked unit tests are not sufficient (Epic 4 retro lesson).

- [x] **Task 10 — Document client-selection rules** (retrospective action A2)
  - [x] Add a short section to `CLAUDE.md` (or create `docs/conventions/supabase-clients.md` and link from CLAUDE.md):
    - Admin client (`lib/supabase/admin.ts`) → server-side reads of cross-tenant or anonymous-session paths where RLS would otherwise block
    - Server client (`lib/supabase/server.ts` via `createClient()`) → owner-side reads/writes and customer writes that must pass RLS
    - Browser client (`lib/supabase/client.ts` via `createClient()`) → Client-Component Realtime subscriptions and reads
    - Postgres error code 42501 overload (covers both WITH CHECK and RETURNING-SELECT failures); customer INSERTs default to no `.select()`
  - [x] Cross-reference this doc from the `RealtimeProvider` and `submitOrder` files in a one-line comment

### Review Findings (2026-05-18)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) returned 48 raw findings. After dedupe + triage: 4 decision-needed, 15 patches, 10 deferred, 7 dismissed.

**Decision-needed (resolve before patching):**

- [x] [Review][Decision] **e2e smoke test bypasses RLS via service client** — story Task 9 said "customer flow OR direct authenticated DB call"; current implementation uses `svc.from('orders').insert(...)` which is service-role and bypasses the `customer_insert_order` RLS path. The 42501 bug from Epic 4 would NOT be caught by this test. Choices: (a) drive customer flow through UI, (b) use an authenticated customer client carrying `app_metadata`, (c) accept the bypass and reword retro action A1's satisfaction claim. [tests/e2e/realtime-order-delivery.spec.ts:55–62]
- [x] [Review][Decision] **OrderCard `itemSummary` ignores `quantity`** — data carries `quantity: number` but the compact row shows only names. UX spec is silent. A kitchen reading "Burger, Fries +1 more" can't tell whether it's one each or twelve. Choices: (a) "2× Burger" prefix, (b) "Burger (×2)" suffix, (c) keep names-only and rely on inline expand in 5.2. [components/admin/OrderCard.tsx:10–15]
- [x] [Review][Decision] **`supabase_realtime` publication membership is a manual Dashboard step with no migration** — fresh clones / CI environments won't have Realtime enabled and the e2e would silently rely on polling. Choices: (a) add `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders` as a migration, (b) document the manual step in the project README/CLAUDE.md, (c) leave as-is. [supabase/migrations/]
- [x] [Review][Decision] **`formatRelativeTime` 60-min boundary is `<` not `<=`** — exact 60 min currently jumps to absolute clock time. UX spec phrasing ("relative up to 60 min") is ambiguous on the boundary. Choices: (a) `<= 60` → keep "60m ago", (b) `< 60` → absolute at 60m (current behaviour), (c) defer to UX sign-off. [utils/formatTime.ts:8]

**Patch (unambiguous fixes):**

- [x] [Review][Patch] **Token refresh leaves Realtime channel with stale JWT** — no `onAuthStateChange` listener; after the 1-hour access-token expiry, `postgres_changes` events silently stop being delivered while the channel still reports `SUBSCRIBED`. [components/shared/RealtimeProvider.tsx:49–82]
- [x] [Review][Patch] **Polling reconnect doesn't re-`setAuth`** — channel can reach `SUBSCRIBED` again after a refresh-during-disconnect but Realtime RLS drops events. On transition into SUBSCRIBED after a prior error, re-fetch session + call `setAuth` before clearing the polling interval. [components/shared/RealtimeProvider.tsx:75–82]
- [x] [Review][Patch] **Status callback re-arms polling after cleanup** — `removeChannel` can emit `CLOSED` asynchronously; without a `cancelled` guard inside the subscribe callback, a fresh `setInterval` gets scheduled that nothing will ever clear. [components/shared/RealtimeProvider.tsx:73–82]
- [x] [Review][Patch] **`bg-surface` is not a defined Tailwind token** — only `surface-base`, `surface-raised`, `surface-overlay` exist; `bg-surface` compiles to no CSS, so the Direction B `#000000` background required by AC4 is not actually applied. [app/admin/orders/page.tsx:29, app/admin/orders/loading.tsx:3]
- [x] [Review][Patch] **Double row border** — `<ul className="divide-y divide-border">` plus `<article className="border-b border-border">` paints two divider lines at every row boundary. [components/admin/OrderFeed.tsx:21 + components/admin/OrderCard.tsx:31]
- [x] [Review][Patch] **e2e `page.waitForTimeout(2000)` flake** — hardcoded sleep hides a missing readiness signal. Replace with a deterministic wait on a `data-realtime-ready` attribute (set when the status callback reports SUBSCRIBED). [tests/e2e/realtime-order-delivery.spec.ts:50–52]
- [x] [Review][Patch] **`refetchOrders` errors silently swallowed** — Realtime is already failing (that's why we're polling); now SELECT errors disappear too. At minimum `console.error(error)` before the early return. [components/shared/RealtimeProvider.tsx:26–35]
- [x] [Review][Patch] **`@ts-expect-error` suppresses the entire `.on()` call** — including payload-handler signature. Narrow to a single-line directive on the literal `'postgres_changes'` string, or type the payload via `RealtimePostgresChangesPayload<Order>`. [components/shared/RealtimeProvider.tsx:58–71]
- [x] [Review][Patch] **`tablesById[order.table_id] ?? 0` renders "Table 0"** — when an order arrives for a table not in the SSR'd lookup (table deleted, race, new table). Render an em-dash and omit the table number from the aria-label. [components/admin/OrderFeed.tsx:25]
- [x] [Review][Patch] **`loading.tsx` skeleton row geometry mismatches `OrderCard`** — real-row height is driven by `text-base font-semibold` (~24px) while skeleton uses `h-4` (16px); `divide-y` vs `border-b` produces a different border count. AC6 ("replaced without layout shift") not met. [app/admin/orders/loading.tsx]
- [x] [Review][Patch] **`OrderCard` empty-items aria-label double comma** — `itemSummary([])` returns `''`, producing `"Order for Table 5, , just now"`. Substitute `"No items"` (or skip the segment) when the items array is empty. [components/admin/OrderCard.tsx:10–21]
- [x] [Review][Patch] **`role="article"` on `<li>` child conflicts with list semantics** — screen readers announce both "list item N of M" and "article", which is confusing. Drop `role="article"`; let the `<li>` carry semantics. [components/admin/OrderCard.tsx:30]
- [x] [Review][Patch] **Overlapping polling fetches can stomp newer state** — `setInterval(refetchOrders, 4000)` fires unconditionally; if the SELECT takes >4s, two requests are in flight and an older snapshot may overwrite a fresher one. [components/shared/RealtimeProvider.tsx:38–40]
- [x] [Review][Patch] **`limit(100)` without `is_handled` filter — silent data loss** — after a busy shift with >100 handled orders the filtered Active view can be empty even when older unhandled orders still exist in DB. Add `.eq('is_handled', false)` to `refetchOrders`. [components/shared/RealtimeProvider.tsx:26–35]
- [x] [Review][Patch] **Store leaks across owner sign-outs** — cleanup doesn't reset the store; owner B sees owner A's orders flash for ~1 second until `refetchOrders` resolves. Call `useOrderStore.setState({ orders: [] })` in the effect cleanup (and/or at the start of init). [components/shared/RealtimeProvider.tsx:85–91]

**Deferred (real but not actionable now):**

- [x] [Review][Defer] **INSERT-only subscription misses UPDATE/DELETE** [components/shared/RealtimeProvider.tsx:58–71] — deferred, Story 5.2 wires `markOrderHandled`; subscription will be expanded to `'*'` there.
- [x] [Review][Defer] **No background reconcile poll on happy path** [components/shared/RealtimeProvider.tsx] — deferred, architectural choice consistent with story scope; safety-net low-rate poll can be added in a future hardening pass.
- [x] [Review][Defer] **Page-level auth duplicates layout auth in `app/admin/orders/page.tsx`** [app/admin/orders/page.tsx:7–18] — deferred, pre-existing pattern across all admin pages; consolidate via shared `getAdminProfile` helper in a future refactor.
- [x] [Review][Defer] **`formatRelativeTime` is not reactive — cards stuck at "3m ago" until something else re-renders the feed** [components/admin/OrderCard.tsx] — deferred, UX not specified for 5.1; wire a 30–60s tick when 5.2/5.3 introduces session-history views.
- [x] [Review][Defer] **`markHandled` placeholder uses client clock** [stores/orderStore.ts:23–28] — deferred, placeholder pending Story 5.2's `markOrderHandled` Server Action; will be replaced with server `now()`.
- [x] [Review][Defer] **`payload.new` / `items: Json` not runtime-validated** [components/shared/RealtimeProvider.tsx:63–68, components/admin/OrderCard.tsx:13] — deferred, matches pre-existing project-wide bare-`as` JSONB cast pattern (same item appears in 2-3, 2-4, 4-3 deferred work); zod-style validation needs a project-wide hardening pass.
- [x] [Review][Defer] **`sortDesc` has unstable tie-break on equal `submitted_at`** [stores/orderStore.ts:8] — deferred, identical-millisecond timestamps are vanishingly rare; add `id` tie-break if the order feed ever surfaces a real-world tie.
- [x] [Review][Defer] **`formatRelativeTime` does not clamp negative diffs (clock skew)** [utils/formatTime.ts] — deferred, NTP keeps clocks within seconds in practice; revisit if clock-skew bug reports surface.
- [x] [Review][Defer] **OrderFeed empty-state flashes during initial hydration before `RealtimeProvider` runs** [components/admin/OrderFeed.tsx + app/admin/orders/page.tsx] — deferred, the no-SSR-of-orders choice is intentional per Dev Notes; add a `hasHydrated` flag in the store as a polish pass when feed becomes more visible.
- [x] [Review][Defer] **`RealtimeProvider` unit test does not assert `setAuth`-before-`subscribe` ordering** [tests/unit/shared/RealtimeProvider.test.tsx] — deferred, this invariant is the load-bearing fix from the e2e iteration; a `mock.invocationCallOrder` assertion would lock it in. Add when patch #1 / #2 are applied (auth-state-change listener).

**Dismissed (7):** signIn TEST_PASSWORD contract (helper convention is established); OrderFeed filter not memoized (N≤100 cap); test slug collision risk (Date.now serial pattern matches existing tests); `min-h-screen` double-clamp (pre-existing pattern, no visible breakage); `subscribe()` sync-status untested (supabase-js dispatches statuses async); React Strict Mode race in init (each useEffect invocation has its own `cancelled` closure — verified); OrderCard omits Mark-handled while UX spec lists it as anatomy (story explicitly overrides UX for 5.1 scope).

### Resolution (2026-05-18)

**Decision outcomes:**
- **D1 (e2e RLS bypass):** Accepted service-role bypass for 5.1. Retro action A1 is therefore *partially* satisfied — owner-side Realtime delivery is exercised end-to-end, but the customer-side `customer_insert_order` RLS path is still only covered by mocks. Added to `deferred-work.md` as a follow-up: drive the customer flow (or use `createAnonCustomerClient` helper) in a future story.
- **D2 (quantity in OrderCard):** Kept names-only for 5.1. Quantity surfaces in Story 5.2's inline expand. No code change.
- **D3 (publication migration):** Added `supabase/migrations/20260518210000_add_orders_to_realtime_publication.sql` (idempotent `ALTER PUBLICATION` guarded by `pg_publication_tables`). Applied to the live DB.
- **D4 (60-min boundary):** Changed `formatRelativeTime` to `<= 60` so exactly 60 minutes still reads "60m ago". Test updated.

**17 patches applied** (15 original + 2 from D3/D4). Highlights:
- `RealtimeProvider` rewritten to (a) propagate `realtime.setAuth` before subscribe and again on every reconnect; (b) listen to `onAuthStateChange` for `TOKEN_REFRESHED` and `SIGNED_OUT`; (c) guard the status callback with `cancelled` to prevent post-unmount polling; (d) filter the initial fetch by `is_handled = false`; (e) deduplicate in-flight polling fetches; (f) `console.error` on SELECT errors; (g) `reset()` the store on cleanup and on sign-out.
- `OrderFeed` exposes `data-realtime-ready` for deterministic e2e waits.
- `OrderCard` drops `role="article"` (let parent `<li>` carry semantics), handles empty items with "No items" + clean aria-label, handles unknown table with "Table —".
- `bg-surface` → `bg-surface-base` everywhere it leaked.
- Tests grew from 257 → 302 (45 net new) covering the new behaviors: `setAuth`-before-`subscribe` ordering, `TOKEN_REFRESHED` re-setAuth, `SIGNED_OUT` reset, post-unmount-polling-guard, `is_handled=false` filter, `Table —` fallback, `data-realtime-ready` attribute.
- E2E test runs in ~5.6s (was 7.4s) with a deterministic readiness signal replacing the 2s hardcoded sleep.

---

## Dev Notes

### Critical Context

**This is the first story in Epic 5.** Epic 4 (Customer Ordering Flow) is fully complete; orders are now being inserted into `public.orders` by anonymous customers. This story builds the owner-side reception of those orders.

**Apply Epic 4 retrospective lessons (carried in as Tasks 9, 10):**
- *Mocked unit tests are not a substitute for an integration path through real RLS.* Task 9 e2e smoke test is non-negotiable before marking done. All 257 unit tests passed in Story 4-5 but `submitOrder` was hard-broken in real conditions because mocks bypassed Postgres entirely.
- *Client-selection asymmetry is project lore.* Task 10 promotes it to documentation. Future stories should not re-derive this from per-story dev notes.
- *Postgres error 42501 is overloaded* (covers both WITH CHECK and RETURNING-SELECT failures). When debugging RLS, retry the failing SQL without `RETURNING` to isolate the side.

**Critical-path prerequisite (verify before starting Task 3):**
- Supabase Realtime must be enabled for `public.orders` in Dashboard → Database → Replication. If it isn't, Task 3 will silently fall through to polling-only mode and the e2e test will be unable to verify AC2. Confirm by inserting an order manually and watching for the `postgres_changes` event in a quick console subscription.

### Architecture Compliance

**Source-of-truth references:**
- Realtime + Zustand pattern: `architecture.md` §"State Management" + §"Realtime Event Handling" (lines 410–435)
- Anti-patterns list: `architecture.md` §"Enforcement Guidelines" (lines 465–481) — pay close attention to: `useOrderStore.getState()` inside callbacks (NOT hooks); `setInterval` (NOT `setTimeout`); `restaurant_id` filter at the subscription level (RLS is the safety net, not the only check)
- OrderCard component spec: `ux-design-specification.md` §"OrderCard (Admin — compact row)" (line 752) + §"Admin order feed (Direction B, mobile)" (line 552)
- Empty state copy: `ux-design-specification.md` §"Empty state copy" (line 842)
- RLS policies already in place: `owner_select_orders` (USING `restaurant_id = get_my_restaurant_id()`) and `owner_update_orders` — verified during Epic 4 retrospective. No new policies or migrations required for 5.1.

**Library / framework requirements (already installed):**
- `@supabase/supabase-js` `latest` — Realtime API via `supabase.channel(...)`.on('postgres_changes', ...)`. Use `'postgres_changes'` not `'INSERT'`.
- `@supabase/ssr` `latest` — `createBrowserClient` for the Realtime subscription (browser context)
- `zustand` already in use (see `stores/cartStore.ts`)
- `lucide-react` for AdminNav icons (already used)
- `tailwindcss` design tokens: `bg-accent` (orange #FF6B35), `bg-surface` (page bg), `bg-surface-overlay` (#2C2C2E handled), `text-text-primary`, `text-text-secondary`, `border-border`. **Do not hardcode hex values.**

### File Structure (NEW vs UPDATE)

| Path | NEW/UPDATE | Purpose |
|---|---|---|
| `types/app.ts` | UPDATE | Add `Order`, `OrderItem` interfaces |
| `stores/orderStore.ts` | NEW | Zustand store for admin order feed |
| `utils/formatTime.ts` | NEW | Relative/absolute timestamp formatter |
| `components/shared/RealtimeProvider.tsx` | NEW | Subscription + polling fallback |
| `components/admin/OrderCard.tsx` | NEW | Compact order row |
| `components/admin/OrderFeed.tsx` | NEW | Active view container, store-subscribed |
| `app/admin/orders/page.tsx` | NEW | Server Component shell + tablesById fetch |
| `app/admin/orders/loading.tsx` | NEW | 3-row skeleton matching OrderCard |
| `app/admin/layout.tsx` | UPDATE | Wrap `{children}` in `<RealtimeProvider restaurantId={...}>` (preserve all current auth + restaurant_id guard logic; do NOT move auth into client) |
| `components/admin/AdminNav.tsx` | UPDATE | Add `Orders` tab between Dashboard and Menu (preserve mobile + desktop variants and `aria-current` behavior) |
| `CLAUDE.md` (or `docs/conventions/supabase-clients.md`) | NEW/UPDATE | Client-selection rules + 42501 gotcha (retro action A2) |
| `tests/unit/stores/orderStore.test.ts` | NEW | Store actions |
| `tests/unit/utils/formatTime.test.ts` | NEW | Each branch |
| `tests/unit/shared/RealtimeProvider.test.tsx` | NEW | Subscribe/payload/fallback/cleanup |
| `tests/unit/admin/OrderCard.test.tsx` | NEW | Anatomy + a11y |
| `tests/unit/admin/OrderFeed.test.tsx` | NEW | Empty state + ordering + reactivity |
| `tests/e2e/realtime-order-delivery.spec.ts` | NEW | Real-DB smoke test (retro action A1) |

### Existing Code That Will Be Modified (READ FIRST)

**`app/admin/layout.tsx`** (current behavior):
- Server Component
- `createClient()` → `getUser()` → redirect `/auth/login` if no user
- SELECT `profiles.restaurant_id` for that user; redirect `/auth/onboarding` if missing
- Renders `<div className="min-h-screen"><AdminNav /><div className="pb-16 lg:pl-56 lg:pb-0">{children}</div></div>`

**What 5.1 changes:** Wrap the existing `{children}` (or the inner `<div>`) in `<RealtimeProvider restaurantId={profile.restaurant_id}>...</RealtimeProvider>`. Preserve auth guard, redirect logic, and existing DOM structure. The provider is a Client Component but its `children` can remain Server Components — this is a standard "client provider wrapping server children" Next.js pattern.

**`components/admin/AdminNav.tsx`** (current behavior):
- Client Component
- 4 tabs in a `tabs` array: Dashboard, Menu, Tables, Settings
- Renders both mobile bottom bar and desktop left sidebar from the same array
- Uses `usePathname()` + `isActive(href, exact)` for `aria-current`

**What 5.1 changes:** Insert a 5th entry `Orders` (href `/admin/orders`) between Dashboard and Menu. Do not refactor the rest. Pick an existing or newly-imported lucide icon (e.g., `ScrollText`, `ClipboardList`, or `Inbox`).

### Previous Story Intelligence (Story 4-5)

- **Server Action pattern:** `actions/orderActions.ts` `submitOrder` returns `ActionResult<SubmitOrderData>`. The INSERT was deliberately written WITHOUT `.select()` after we hit the 42501/RETURNING bug. Story 5.2 (`markOrderHandled`) will follow the same shape and the same rule.
- **Items shape currently in DB:** `items` jsonb is `{ name: string; quantity: number; variants: string[] }[]` — variant strings are option names only (no IDs, no prices). This is what `OrderCard`'s item summary must read.
- **Tests in 4-5 mocked `submitOrder` entirely.** No unit test would have caught the RETURNING bug. This is exactly why Task 9 (real-DB e2e) is required for 5.1.

### Testing Standards

- Unit tests: `vitest --run`, `@testing-library/react`, jsdom environment. Existing convention: each store/util/component has `tests/unit/<area>/<file>.test.{ts,tsx}`.
- e2e tests: `npm run test:e2e` (Playwright). Existing example: `tests/e2e/menu-publish.spec.ts`. RLS helpers at `tests/rls/helpers.ts` — reuse if applicable.
- Store reset pattern in tests: `useOrderStore.setState({ orders: [] })` in `beforeEach` (mirrors the Zustand reset pattern established in Epic 4).
- For `RealtimeProvider` unit tests: mock the supabase channel with a small fake exposing `.on().subscribe(cb)` and a `triggerStatus(status)` / `triggerPayload(payload)` interface. Do NOT use the real client in unit tests.

### Anti-Patterns to Avoid

- `useOrderStore()` (hook) inside a Realtime callback → use `useOrderStore.getState()` instead
- `setTimeout` polling → use `setInterval(... , 4000)`
- Subscribing without a `restaurant_id` filter → always filter at the channel level
- SSR-fetching orders in `app/admin/orders/page.tsx` → causes a race with `RealtimeProvider`'s store hydration; `tablesById` is the only SSR fetch in this page
- Hardcoded hex values → use Tailwind design tokens (`bg-accent`, etc.)
- Wiring "Mark handled" or tab switching in this story → that is Story 5.2 scope. Leave a TODO with the story key.
- Showing prices anywhere in OrderCard or OrderDetailPanel → owner-side displays never show prices per UX spec (orders show items, not money)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — AC source
- [Source: _bmad-output/planning-artifacts/architecture.md#State Management] — Zustand pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Realtime Event Handling] — subscription pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — anti-patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#OrderCard] — component spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Admin order feed (Direction B, mobile)] — visual spec
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-05-18.md] — actions A1, A2, C1
- [Source: _bmad-output/implementation-artifacts/4-5-order-submission-confirmation.md] — order row shape + lessons

### Project Structure Notes

- New `app/admin/orders/` directory: aligns with architecture.md §"Complete Project Directory Structure" line 530–532.
- New `components/shared/RealtimeProvider.tsx`: `components/shared/` currently empty; this is its first inhabitant per architecture spec.
- New `stores/orderStore.ts`: mirrors `stores/cartStore.ts` pattern exactly — one store per domain, actions inside the store, `set()` only.
- No new migrations required. RLS policies on `orders` already cover owner SELECT/UPDATE (validated in Epic 4 retrospective).

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Implementation Plan (Executed)

1. Added `Order` and `OrderItem` types to `types/app.ts`. Built `useOrderStore` (Zustand) with `setOrders` (sorted DESC), `addOrder` (idempotent prepend with sort), and `markHandled` (placeholder for 5.2).
2. Built `formatRelativeTime` with three branches: `just now` (<1 min), `Xm ago` (<60 min), absolute `h:mm AM/PM` (≥60 min).
3. Built `RealtimeProvider`. The init sequence is `getSession → realtime.setAuth → refetchOrders → channel.subscribe`. Polling fallback (`setInterval` at 4000ms) starts on `CHANNEL_ERROR`/`CLOSED`/`TIMED_OUT` and stops on `SUBSCRIBED`. Unmount cleans up both the channel and any active interval.
4. Wrapped `RealtimeProvider` around the children in `app/admin/layout.tsx`, preserving the existing server-side auth + `restaurant_id` guard.
5. Built `OrderCard` (compact row, `role="article"`, 8px dot, bold table number, truncated item summary, relative timestamp, `aria-label="Order for Table {n}, {items}, {time}"`). Mark-handled and tap-to-expand explicitly deferred to Story 5.2.
6. Built `OrderFeed` Client Component. Subscribes to `useOrderStore`, filters to unhandled orders, resolves table numbers via `tablesById` prop, renders empty state copy when filter is empty.
7. Built `app/admin/orders/page.tsx` (Server Component) and `loading.tsx` (3-row skeleton matching `OrderCard` layout, no layout shift).
8. Added `Orders` tab (lucide `Receipt` icon) between Dashboard and Menu in `AdminNav`. Mobile bottom bar handles 5 tabs cleanly.
9. Wrote `tests/e2e/realtime-order-delivery.spec.ts`. First run revealed that the subscription reached `SUBSCRIBED` status but no `postgres_changes` payloads were delivered — diagnosed via browser-console capture as the `realtime.setAuth(...)` call needing to happen *before* `.subscribe()`. Restructured `init()` accordingly; e2e now passes in ~7s end-to-end.
10. Created `docs/conventions/supabase-clients.md` (client-selection table, Realtime auth caveat, the `42501` overload, custom access token hook reminder, and cross-references). Added one-line cross-ref comments at the top of `actions/orderActions.ts` and `components/shared/RealtimeProvider.tsx`.

### Debug Log References

- Realtime subscription reached `SUBSCRIBED` but no INSERT payloads were delivered until `supabase.realtime.setAuth(session.access_token)` was awaited **before** `.subscribe()`. Setting auth after subscribe is too late — the channel has already negotiated with the prior (anonymous) token, and RLS-on-Realtime drops the events silently.
- Confirmed `public.orders` is in the `supabase_realtime` publication (retrospective C1 satisfied at the DB level): `SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`.

### Completion Notes List

- All 10 tasks complete. 48/48 subtask checkboxes marked.
- Unit suite: 288/288 passing (was 257; +31 from this story across `orderStore`, `formatTime`, `RealtimeProvider`, `OrderCard`, `OrderFeed`).
- E2E suite: `realtime-order-delivery.spec.ts` passing (~7s).
- Lint: clean on every file touched by this story.
- Retro lessons applied: A1 (real-DB e2e) is in place; A2 (client-selection docs) is committed and cross-referenced from code.
- Out of scope for 5.1 (carried forward to 5.2): Active/Handled/All tab bar, "Mark handled" action wiring, inline expand-to-detail.
- One pre-existing project quirk surfaced: `npm run lint` against the whole project reports ~49k errors, predominantly in generated `.next/` artifacts. Targeted lint on every story file is clean. Project-wide lint hygiene is unrelated to this story.

### File List

NEW:
- `stores/orderStore.ts`
- `utils/formatTime.ts`
- `components/shared/RealtimeProvider.tsx`
- `components/admin/OrderCard.tsx`
- `components/admin/OrderFeed.tsx`
- `app/admin/orders/page.tsx`
- `app/admin/orders/loading.tsx`
- `docs/conventions/supabase-clients.md`
- `tests/unit/stores/orderStore.test.ts`
- `tests/unit/utils/formatTime.test.ts`
- `tests/unit/shared/RealtimeProvider.test.tsx`
- `tests/unit/admin/OrderCard.test.tsx`
- `tests/unit/admin/OrderFeed.test.tsx`
- `tests/e2e/realtime-order-delivery.spec.ts`

UPDATED:
- `types/app.ts` — added `Order` and `OrderItem` interfaces
- `app/admin/layout.tsx` — wrapped children with `<RealtimeProvider restaurantId={...}>`
- `components/admin/AdminNav.tsx` — added Orders tab + `Receipt` icon import
- `actions/orderActions.ts` — added a header comment cross-referencing `docs/conventions/supabase-clients.md`

### Change Log

- 2026-05-18 — Implemented Story 5.1. Owner-side Realtime order feed with polling fallback, RLS-aware Realtime auth, OrderCard compact rows, and a real-DB e2e smoke test. Status → review.
- 2026-05-18 — Addressed code review findings: 4 decision-needed resolved, 17 patches applied, 11 deferred, 7 dismissed. Major upgrades to `RealtimeProvider` (token-refresh listener, setAuth on reconnect, cleanup-race guard, in-flight dedupe, `is_handled=false` filter, store reset on sign-out/unmount). New `ALTER PUBLICATION` migration. Tests 288→302. Status → done.
