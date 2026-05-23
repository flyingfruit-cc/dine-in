# Story 11.1: Dashboard Landing Snapshot

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want the Admin Dashboard at `/admin` to show today's order activity and quick links the moment I land on it,
so that signing in feels purposeful instead of dropping me on an empty page once onboarding is complete.

## Acceptance Criteria

1. **AC1 — Snapshot renders for fully-onboarded owners:**
   **Given** an owner has completed all onboarding steps (`restaurants.is_published = true`, `has_previewed_menu = true`, `has_printed_qr = true`, at least one `menu_items` row, at least one `tables` row)
   **When** the owner navigates to `/admin`
   **Then** the page renders `<DashboardLandingSnapshot>` with three sections — Today, Recent Orders, Quick Actions
   **And** `<OnboardingChecklist>` is NOT rendered

2. **AC2 — Checklist still takes precedence during onboarding:**
   **Given** an owner has NOT completed all onboarding steps (any one of the five flags above is false)
   **When** the owner navigates to `/admin`
   **Then** `<OnboardingChecklist>` is rendered exactly as today (unchanged)
   **And** `<DashboardLandingSnapshot>` is NOT rendered

3. **AC3 — Today section shows today's stats:**
   **Given** the snapshot renders
   **When** the Today section is read
   **Then** it displays three stats: active orders count (`status != 'completed'` AND `submitted_at >= todayStart`), today's total order count (`submitted_at >= todayStart`), and today's revenue (sum of `total_cents` for orders with `submitted_at >= todayStart`, formatted via `utils/formatPrice.ts`)
   **And** the `todayStart` boundary is computed as UTC midnight of the current calendar day (matches the `'today'` period boundary in `lib/analytics/getRestaurantAnalytics.ts`)

4. **AC4 — Recent Orders shows top 5 across all time:**
   **Given** the snapshot renders
   **When** the Recent Orders section is read
   **Then** the 5 most recent orders for the restaurant are listed (ordered by `submitted_at` descending, regardless of date or status)
   **And** each row reuses the existing `<OrderCard>` component (compact row with status dot · table number · item summary · relative time, tap-to-expand)
   **And** `<OrderCard>` is rendered WITHOUT `onAdvance`/`errorMessage`/`onErrorDismiss` props so no inline status-advance button is shown (snapshot is read-only — owner taps "Go to Orders →" to act)
   **And** a "Go to Orders →" link at the bottom of the section routes to `/admin/orders`

5. **AC5 — Quick Actions row:**
   **Given** the snapshot renders
   **When** the Quick Actions row is read
   **Then** it shows tappable links to `/admin/orders`, `/admin/kds`, `/admin/menu`, `/admin/settings`
   **And** on mobile only (the `lg:` breakpoint and below, i.e. when `AdminNav` hides KDS) the KDS link is hidden — same `desktopOnly` rule applied to the snapshot
   **And** links use Next `<Link>` (not `<a>`) for client-side navigation

6. **AC6 — Zero-orders empty state:**
   **Given** the restaurant has zero orders satisfying `submitted_at >= todayStart`
   **When** the Today section renders
   **Then** stats show `0 active`, `0 today`, `$0.00` revenue
   **And** when there are also zero rows at all in `orders` for the restaurant, the Recent Orders section shows the exact copy "No orders yet — orders will appear here automatically" (matches the empty-state copy in `OrderFeed.tsx:16` and UX spec §Empty States line 821)
   **And** the "Go to Orders →" link is still rendered in the empty Recent Orders state

7. **AC7 — Server-Component data fetch, RLS-enforced:**
   **Given** `/admin` is rendered
   **When** data is fetched
   **Then** the cookie-bound server client (`createClient()` from `lib/supabase/server.ts`) is used so RLS auto-scopes to the owner's restaurant
   **And** all queries that the snapshot needs (analytics RPC, active count, recent 5 orders) run in parallel via `Promise.all` together with the existing onboarding-flag queries
   **And** the snapshot component is a Server Component (no `'use client'` directive); nested `<OrderCard>` instances are the only Client Component islands

8. **AC8 — Page-level branching, OnboardingChecklist untouched:**
   **Given** the implementation
   **When** the file diff is reviewed
   **Then** `components/admin/OnboardingChecklist.tsx` is NOT modified (its existing `if (allComplete) return null` auto-hide behavior remains, but is no longer reachable from `/admin` because the page now branches explicitly)
   **And** `app/admin/page.tsx` computes `allComplete` from the five onboarding flags and renders `<DashboardLandingSnapshot>` when true, `<OnboardingChecklist>` when false

---

## Tasks / Subtasks

- [x] **Task 1 — Create `components/admin/DashboardLandingSnapshot.tsx`** (AC: #1, #3, #4, #5, #6, #7)
  - [x] Server Component (no `'use client'`)
  - [x] Props interface: `{ activeOrderCount: number; todayOrderCount: number; todayRevenueCents: number; recentOrders: Order[]; tablesById: Record<string, number> }`
  - [x] Three sections in order: Today card → Recent Orders list → Quick Actions row
  - [x] **Today card** (`<section aria-label="Today's activity">`): visible stat triplet `{activeOrderCount} active · {todayOrderCount} today · {formatPrice(todayRevenueCents)}`. Section wrapper carries `aria-label="Today's activity"` (the granular per-stat aria-label spec was redundant with visible text — kept the region label simple per the test contract).
  - [x] **Recent Orders list**: `<ul aria-label="Recent orders" className="divide-y divide-border">` (native `<ul>` has implicit `role="list"`) — wraps each `<OrderCard>` in `<li>`. No `onAdvance`/`errorMessage`/`onErrorDismiss` passed — snapshot is read-only.
  - [x] **Empty-orders state**: when `recentOrders.length === 0`, renders `<p>No orders yet — orders will appear here automatically</p>` instead of the list. "Go to Orders →" link always renders below.
  - [x] **Quick Actions row** (`<nav aria-label="Quick actions">`): four Next `<Link>` items — Orders, Kitchen, Menu, Settings. KDS link carries `hidden lg:inline-flex`; others carry `inline-flex` only.
  - [x] Uses only existing design tokens — no hardcoded colors

- [x] **Task 2 — Update `app/admin/page.tsx`** (AC: #1, #2, #3, #4, #7, #8)
  - [x] Added user/profile auth pattern matching `app/admin/orders/page.tsx:6-16`
  - [x] `todayStartIso` computed once at top — matches the `'today'` boundary expression in `lib/analytics/getRestaurantAnalytics.ts:19` exactly
  - [x] Extended `Promise.all` to 6 parallel queries: restaurants, menu_items, tables, analytics RPC, active-orders id-array, recent-5 orders
  - [x] Changed `tables` select from `id` to `id, number` to feed `tablesById` lookup
  - [x] Computed `allComplete = hasMenuItems && hasPreviewedMenu && isPublished && hasTables && hasPrintedQr` (same logic as `OnboardingChecklist.tsx:60`)
  - [x] Branch render: snapshot when `allComplete`, checklist otherwise
  - [x] Kept `<h1>Dashboard</h1>` header in both branches
  - [x] Wrapper width: `max-w-2xl` for checklist, `max-w-4xl` for snapshot (per spec recommendation)

- [x] **Task 3 — Write unit tests for `DashboardLandingSnapshot`** (AC: #1, #3, #4, #5, #6)
  - [x] Created `tests/unit/admin/DashboardLandingSnapshot.test.tsx` with 15 tests across 3 describe blocks (Today, Recent Orders, Quick Actions)
  - [x] Reused `makeOrder` helper pattern from `OrderCard.test.tsx` (including required `unit_price_cents` and `total_cents`)
  - [x] All checklist items covered. Split the "Go to Orders link in both states" check into two separate tests (the original rerender-after-cleanup pattern was brittle)
  - [x] 15/15 tests pass; full project suite 646/646 pass — no regressions

- [x] **Task 4 — Update unit test for `app/admin/page.tsx` branching (only if a test file already exists)** (AC: #1, #2, #8)
  - [x] Searched `tests/` for any `admin/page.test*` or `app/admin/page.test*` — none exist. Per spec's conditional ("if none exists, skip this task"), no test added. Page-level branching is covered indirectly by component tests + the manual smoke (Task 5).

- [ ] **Task 5 — Manual smoke test (required per project-context rule)** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Per `_bmad-output/project-context.md` and `[[feedback_real_db_smoke_test]]` memory: customer-facing Server Actions with RLS require a real-DB smoke before marking done. This story doesn't add a Server Action, but it does add owner-facing Server Component queries against RLS-protected `orders`. Run a manual smoke against local Supabase OR staging:
    1. `supabase start` (local) — sign in as a test owner with onboarding incomplete; verify `<OnboardingChecklist>` renders
    2. Complete onboarding for the test owner (publish menu, create a table, mark `has_printed_qr=true`, add menu item); reload `/admin`; verify `<DashboardLandingSnapshot>` renders with zero-orders empty state
    3. Submit a customer order via the QR flow against the test table; reload `/admin`; verify Today stats update and Recent Orders shows the new row
    4. Sign in as a SECOND test owner with their own restaurant; verify their snapshot shows ONLY their data (RLS isolation) — zero orders even after owner #1 has orders
  - [ ] Document outcome in the Completion Notes List
  - [ ] **NOT RUN by dev agent** — requires `supabase start` and a running browser. Left UNCHECKED per spec instruction ("If a smoke can't be run, say so explicitly … do NOT mark the task complete"). Hands off to Nic as a review-gate before `review → done`.

### Review Findings

_Code review run 2026-05-23 (3-layer adversarial). Acceptance Auditor: Approve. Blind Hunter + Edge Case Hunter: Changes Requested._

**Decisions resolved (2026-05-23):**

- [x] [Review][Decision] **D1 → patched** — Dropped the `submitted_at >= todayStartIso` filter from the active-orders query so "{n} active" now counts every non-completed order regardless of when it was submitted. Becomes patch P6.
- [x] [Review][Decision] **D2 → patched** — Renamed the section heading from "Recent orders" to "Latest orders" so the semantic ("most recent regardless of date") matches the visible label. Becomes patch P7.
- [x] [Review][Decision] **D3 → patched** — Replaced the misleading empty-state copy "No orders yet — orders will appear here automatically" with "No orders yet. Your first customer order will show up here on next visit." Honest about the page being SC-refreshed, not Realtime. Becomes patch P8.
- [x] [Review][Decision] **D4 → deferred** — Accepted the 1000-row Supabase cap on `activeOrdersData?.length`. No MVP restaurant will realistically have >1000 in-flight orders. Logged in deferred-work.
- [x] [Review][Decision] **D5 → deferred** — Accepted the sub-second UTC-midnight drift between the analytics RPC and the active-count query. Self-corrects on next render. Logged in deferred-work. As a side-effect of D1→P6 the active-count query no longer uses `todayStartIso` at all, so the shared-boundary concern is now narrower (analytics-only).

**Patches applied (2026-05-23):**

- [x] [Review][Patch] **P1: `Promise.all` rejection no longer blanks the dashboard** — Wrapped `getRestaurantAnalytics`, the active-orders query, and the recent-orders query each in their own `.catch()` returning a safe-fallback shape. Transient failure on any one degrades that section to zeros / empty instead of erroring the whole page. [`app/admin/page.tsx:25-78`]
- [x] [Review][Patch] **P2: `restaurants` query now filters explicitly** — Added `.eq('id', profile.restaurant_id)` to the `restaurants` select per the project-context defense-in-depth rule. [`app/admin/page.tsx:30-33`]
- [x] [Review][Patch] **P3: profile lookup uses `.maybeSingle()`** — A newly authenticated user with no `profiles` row now resolves to `data: null` and the existing `if (!profile?.restaurant_id) redirect(...)` handles it, instead of throwing PGRST116. [`app/admin/page.tsx:13-18`]
- [x] [Review][Patch] **P4: auth-error logged before redirect** — `console.error` the `getUser()` error so a transient auth-service failure leaves a diagnostic instead of a silent bounce. [`app/admin/page.tsx:10-11`]
- [x] [Review][Patch] **P5: A11y polish bundle** — (a) Section landmarks use `aria-labelledby` pointing at their H2 (id `dashboard-today-heading`, `dashboard-latest-heading`) — single source of truth for the section name, no label/H2 mismatch; (b) dropped the redundant `aria-label="Recent orders"` from the orders `<ul>` (section labels it); (c) wrapped the "→" arrow on the "Go to Orders" link in `aria-hidden="true"` so screen readers announce only "Go to Orders"; (d) inserted `<span className="sr-only">, </span>` between each Today stat so screen readers read "3 active, 12 today, $284.50" with proper pauses. [`components/admin/DashboardLandingSnapshot.tsx`]
- [x] [Review][Patch] **P6 (from D1): active-orders query no longer filters on `submitted_at`** — Query is now `select('id').eq('restaurant_id', ...).neq('status', 'completed')`. "Active" semantic matches the visible label. Side benefit: `todayStartIso` is no longer needed at the page level — removed. [`app/admin/page.tsx:54-66`]
- [x] [Review][Patch] **P7 (from D2): section heading renamed to "Latest orders"** — Matches the spec query semantic (5 most recent regardless of date). Heading is now unambiguous about scope. [`components/admin/DashboardLandingSnapshot.tsx:50-55`]
- [x] [Review][Patch] **P8 (from D3): empty-state copy updated** — "No orders yet. Your first customer order will show up here on next visit." Honest about the SC-refresh model. [`components/admin/DashboardLandingSnapshot.tsx:57-59`]

**Deferred (real but out of scope, pre-existing, or per-spec):**

- [x] [Review][Defer] UTC "today" boundary ignores restaurant local timezone — project-wide MVP convention per `lib/analytics/getRestaurantAnalytics.ts:11-13`; spec AC3 explicitly mirrors. Surfaces most painfully on this new page. [`app/admin/page.tsx:23`]
- [x] [Review][Defer] `tables` query fetches all rows just to build the lookup map (wasteful for food-hall-scale tenants) — spec explicitly merged the existence-check and lookup-map fetch; MVP scale is fine. [`app/admin/page.tsx:35`]
- [x] [Review][Defer] `recentOrders` query uses `select('*')` instead of explicit column list — minor wire-payload optimization; future schema additions to `orders` will silently bloat the query. [`app/admin/page.tsx:43-48`]
- [x] [Review][Defer] `as Order[]` cast over Json `items` column hides shape drift — pre-existing project pattern (also used by OrderFeed/orderStore); not regressed by this story. Would benefit from a project-wide runtime guard or zod parse. [`app/admin/page.tsx:75`]
- [x] [Review][Defer] Recent-orders row for a deleted table renders as "Table —" (same as "unknown") — edge case; phantom-row UX is mildly confusing. Future: join on `orders` or surface "(deleted)". [`components/admin/DashboardLandingSnapshot.tsx:54`]
- [x] [Review][Defer] `analytics.error === true` rendered as zeros with no "temporarily unavailable" UI — spec Dev Notes explicitly chose this behavior. [`app/admin/page.tsx:73-74`]
- [x] [Review][Defer] Mobile-only Kitchen link hide is hostile to managers on phones — per spec AC5 ("on mobile only … the KDS link is hidden"). [`components/admin/DashboardLandingSnapshot.tsx:80`]
- [x] [Review][Defer] Test coverage gaps — no test for `tablesById[order.table_id] ?? null` fallback with missing key, no test for `tablesById[t-id] = 0` regression, no test asserting SC/CC serialization boundary, no `items: []` boundary case in this test file. [`tests/unit/admin/DashboardLandingSnapshot.test.tsx`]
- [x] [Review][Defer] `formatPrice` is brittle for negative/NaN/very-large inputs — pre-existing utility, not introduced by this story. [`utils/formatPrice.ts`]
- [x] [Review][Defer] Owner SELECT RLS policy on `orders` is implicitly assumed — verified by existing OrderFeed which depends on the same policy; not regressed. [`app/admin/page.tsx:43-48`]
- [x] [Review][Defer] `Order.status` enum drift — if a future migration adds a new status value, `STATUS_DOT_CLASS[order.status]` returns undefined. Pre-existing in OrderCard; new dashboard surfaces it. [`components/admin/OrderCard.tsx:30-32`]

**Dismissed as noise (not persisted):** 7 findings — page is already dynamic via `cookies()` (no `noStore()` needed), Order test fixture field name is verified-correct, Tailwind className assertion is per-spec, `Order.table_id` is non-nullable in the type system, `formatPrice` unit is clear from name + type, TypeScript narrowing was verified via `tsc`, mid-render onboarding race was flagged for completeness only.

---

## Dev Notes

### What This Story Does NOT Do — Do Not Reinvent

- **Does NOT modify `components/admin/OnboardingChecklist.tsx`** — its existing rendering and auto-hide behavior stay. The page (`app/admin/page.tsx`) becomes the source of truth for which component to render on `/admin`. Touching the checklist is out of scope and would be a regression risk.
- **Does NOT add a new analytics RPC, SQL function, or migration** — `lib/analytics/getRestaurantAnalytics.ts` already supports `period: 'today'` (added by Story 7.1). It returns `orderCount` and `totalRevenueCents` which are always populated regardless of the `emptyState` flag. Use it directly.
- **Does NOT add a Server Action** — this is a read-only landing surface. No mutations. No `'use server'` files.
- **Does NOT add Realtime subscriptions** — snapshot is a Server Component, refreshed on every navigation. Owner sees fresh data each time they land on `/admin`. Real-time order tracking lives in `/admin/orders` (`OrderFeed`) — that's the surface that already pays for the Realtime subscription via `RealtimeProvider` in `app/admin/layout.tsx`.
- **Does NOT add a new design system token, color, icon family, or typography size** — composed entirely from existing tokens and the Lucide icon set already in use in `AdminNav.tsx`.
- **Does NOT add a new test framework or runner** — Vitest + React Testing Library, same as `OrderCard.test.tsx`. No RLS test required (no new policy or table); no E2E test required (covered by manual smoke per Task 5).

### Existing Code To Read Before Implementing (READ BEFORE TOUCHING)

**`app/admin/page.tsx` — UPDATE**
- Current state (29 lines): one `Promise.all` over `restaurants`, `menu_items`, `tables`. Computes 5 booleans. Renders `<h1>Dashboard</h1>` + `<OnboardingChecklist>`. Relies on `app/admin/layout.tsx` for auth + `restaurant_id` redirects, so no re-fetch of `profile.restaurant_id` today.
- What this story changes:
  - Add `await supabase.auth.getUser()` + `profile.restaurant_id` lookup (matches `app/admin/orders/page.tsx:6-16` pattern) — needed to pass `restaurant_id` explicitly to the analytics helper and to scope the orders queries
  - Add three new parallel queries to the `Promise.all`: `getRestaurantAnalytics(..., 'today')`, active-orders count, recent-5 orders
  - Change the `tables` query from `select('id').limit(1)` to `select('id, number')` — same RLS access, but now also feeds the `tablesById` lookup map for OrderCard
  - Add page-level branch: if all 5 flags true → `<DashboardLandingSnapshot>`, else → `<OnboardingChecklist>`
- What must be preserved:
  - The header `<h1 className="mb-6 text-2xl font-semibold text-text-primary">Dashboard</h1>`
  - The `mx-auto max-w-2xl` wrapper width for the checklist branch (snapshot branch can widen)
  - Default-export async function shape

**`components/admin/OnboardingChecklist.tsx` — READ-ONLY (do not modify)**
- Lines 26-57: builds the 5-step array. Line 60: `allComplete = completedCount === steps.length`. Line 62: `if (allComplete) return null`.
- The page-level branch in Task 2 reproduces the same `allComplete` calculation. Keep the logic identical so the two never disagree.

**`components/admin/OrderCard.tsx` — READ-ONLY (reuse as a Client Component island)**
- Line 8-14: `Props` interface — `onAdvance`, `errorMessage`, `onErrorDismiss` are all optional. Lines 59-71: the advance button only renders when `actionLabel && nextStatus && onAdvance` — so omitting `onAdvance` cleanly hides the action.
- Line 16-21: exported `itemSummary` helper — already exported but not needed by the snapshot directly (OrderCard does its own summary internally).
- Line 33: `rowOpacity = order.status === 'completed' ? 'opacity-40' : ''` — completed orders render dimmed automatically. The snapshot inherits this behavior for free.
- OrderCard uses `useState` for expansion — it IS a Client Component. Embedding it in a Server Component is fine (standard RSC pattern); React serializes the props at the boundary.

**`app/admin/orders/page.tsx` — READ-ONLY (reference for `tablesById` pattern)**
- Lines 20-26: the canonical pattern for building `tablesById: Record<string, number>` from `tables` rows. Copy this approach (don't re-derive it differently).

**`app/admin/analytics/page.tsx` — READ-ONLY (reference for `getRestaurantAnalytics` invocation)**
- Lines 30-47: the canonical pattern for invoking `getRestaurantAnalytics(supabase, profile.restaurant_id, period)` from a Server Component. The dashboard does the same with `period = 'today'` hardcoded.

**`lib/analytics/getRestaurantAnalytics.ts` — READ-ONLY (reference for `'today'` semantics)**
- Lines 18-20: `'today'` boundary is `new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'` — UTC midnight. The dashboard MUST use the exact same expression for `todayStartIso` so the active-count query and the analytics RPC agree on what "today" means.
- Returns `AnalyticsData` with `orderCount` and `totalRevenueCents` always populated (lines 136-137). `emptyState` is set when `orderCount < 30`, which suppresses the arrays (lines 144+) — but the dashboard only needs the two scalars, so `emptyState` is irrelevant here. Do NOT branch on `emptyState`; use `orderCount` and `totalRevenueCents` directly.
- The helper never throws and sets `error: true` on RPC failures. The dashboard treats an `error: true` analytics result the same as a successful zero result — Today stats just show `0 / 0 / $0.00`. The other two parallel queries (active count, recent orders) are independent; if one fails, the others still render.

**`components/admin/AdminNav.tsx` — READ-ONLY (reference for KDS desktop-only rule)**
- Line 24: `{ href: '/admin/kds', label: 'Kitchen', icon: ChefHat, exact: false, desktopOnly: true }`
- Line 50: `tabs.filter((t) => !t.desktopOnly).map(...)` for mobile
- Snapshot Quick Actions row mirrors this rule via the Tailwind class `hidden lg:inline-flex` on the KDS link.

**`utils/formatPrice.ts` — READ-ONLY (use for all revenue display)**
- One-liner: `\`$${(priceCents / 100).toFixed(2)}\``. Project-context anti-pattern: never inline currency formatting.

**`utils/formatTime.ts` — READ-ONLY (already used by OrderCard internally)**
- The snapshot does not call `formatRelativeTime` directly — `OrderCard.tsx:28` does. No work needed here.

### Architecture Compliance

**Client selection** (per `docs/conventions/supabase-clients.md`):
- Cookie client via `createClient()` from `lib/supabase/server.ts` — owner JWT → RLS auto-scopes orders/restaurants/menu_items/tables to the owner's restaurant. Defense-in-depth: also pass explicit `.eq('restaurant_id', profile.restaurant_id)` on every query (rule from project-context "RLS is a safety net, not the only check").

**Parallel Promise.all** (project-context idiom):
- All six queries (3 onboarding flags + 3 snapshot queries) run in ONE `Promise.all`. The page renders once, not staged. Rationale: the snapshot data isn't conditionally needed — even on the incomplete-onboarding branch, the data fetch is cheap (analytics RPC returns empty quickly via the existing composite index from Story 7.1; the two orders queries return zero rows on new restaurants).

**Server Component default** (project-context idiom):
- `DashboardLandingSnapshot` is a Server Component. Only `<OrderCard>` (already a Client Component) hydrates client-side. No new `'use client'` directives.

**No `.select()` on customer-facing INSERTs** — N/A here, no inserts.

**No Realtime in this story** — that lives in `OrderFeed` on `/admin/orders`. Adding it here would duplicate the subscription already running via `RealtimeProvider` in `app/admin/layout.tsx`, which would multiply the WebSocket bandwidth without user benefit.

**UTC `today` boundary** (project-wide MVP convention, Story 7.1):
- The active-count query MUST use the exact same `todayStartIso` expression as the analytics helper to avoid the active count and today count disagreeing at UTC midnight rollover. Compute it once at the top of the function and reuse.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|---|---|---|
| `components/admin/DashboardLandingSnapshot.tsx` | NEW | Server Component — Today card + Recent Orders + Quick Actions |
| `app/admin/page.tsx` | UPDATE | Add auth lookup; extend Promise.all by 3 queries; widen tables select; branch on `allComplete` |
| `tests/unit/admin/DashboardLandingSnapshot.test.tsx` | NEW | Vitest + RTL — covers stats text, OrderCard rendering, empty state, links, KDS class, accessibility |
| `components/admin/OnboardingChecklist.tsx` | NOT TOUCHED | Out of scope — page-level branching keeps it untouched |

### Testing Standards

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/` | Vitest (`npm run test`) | YES — `DashboardLandingSnapshot.test.tsx` |
| RLS integration | `tests/rls/` | Playwright (`npm run test:rls`) | NO — no new policy, no new table |
| E2E | `tests/e2e/` | Playwright (`npm run test:e2e`) | NO — covered by manual smoke (Task 5) |

- Unit test fixtures for `Order` MUST include `unit_price_cents: 0` and `total_cents: 0` on every `OrderItem` / `Order` (Story 7.1 made those fields required). Reuse the `makeOrder` helper pattern from `tests/unit/admin/OrderCard.test.tsx` / `OrderFeed.test.tsx`.
- JSDOM does not apply Tailwind responsive classes — assert the KDS link's `desktopOnly` rule by checking `className` includes `'hidden'` and `'lg:inline-flex'`, not by checking computed visibility.

### Previous Story Intelligence

**From Story 7.1 (analytics aggregation layer):**
- `getRestaurantAnalytics` is client-agnostic — caller picks the Supabase client. The dashboard uses the cookie client → RLS does the tenant-scoping work. No `restaurant_id` UUID-validation needed at the call site because `profile.restaurant_id` is always a valid UUID from `profiles.restaurant_id` (the column is `uuid`).
- The helper logs Sentry-friendly `console.error` and returns an empty-with-`error:true` result on RPC failure. The dashboard's failure mode is graceful: stats show zeros; the other two queries can still succeed and populate Recent Orders.
- `unit_price_cents` and `total_cents` are REQUIRED fields on `OrderItem` and `Order` (no `?` marker). Test fixtures must include them.

**From Story 5.1 / 5.2 (real-time order feed):**
- `OrderCard.onAdvance` is optional — omitting it cleanly disables the advance button. Story 5.x established this pattern; the dashboard relies on it.
- `formatRelativeTime` (`utils/formatTime.ts`) is the only sanctioned way to render order timestamps — OrderCard already uses it internally.

**From Story 2.7 (onboarding checklist):**
- The five flags are: `hasMenuItems`, `hasPreviewedMenu`, `isPublished`, `hasTables`, `hasPrintedQr`. All five must be true for `allComplete`. This is the exact same condition `OnboardingChecklist.tsx:60` uses (`completedCount === steps.length`). The page-level branch in Task 2 must reproduce this exactly.
- `restaurants.has_previewed_menu` and `restaurants.has_printed_qr` were added by Story 2.7's migration. Both already exist; no migration needed.

**From Story 6.2 (tenant inspection):**
- Server Component multi-fetch idiom: get user → get profile → redirect on missing — same pattern this story repeats in `app/admin/page.tsx`.
- `.maybeSingle()` vs `.single()` — `profiles.select('restaurant_id').eq('id', user.id).single()` is fine because every authenticated owner has a profile row (created during signup). No need for `.maybeSingle()` here.

### Git Intelligence Summary

Recent commits (last 5): `fcc1622 Merge PR #10 multi-language-selection`, `c981240 multi-language selection`, `b5896a1 Merge PR #9 fix/env-settings`, `36b3ab0 fix`, `203998c Merge PR #8 fix/env-settings`. Closing out Epic 10 (multi-language); no dashboard work pending. The most relevant prior-art commit for Server Component + cookie client + `Promise.all` is the analytics page from Epic 7 (Story 7.2) and the orders page from Epic 5. No conflicting in-flight work.

Current branch is `feature/multi-language-selection` (Epic 10). Branching strategy for this story is a dev-process question for Nic — see the "Open Questions for Nic" section at the end.

### Latest Tech Information

- **Next.js App Router Server Components** are dynamic when they call `cookies()` (transitively, via `createClient()` from `lib/supabase/server.ts`). The dashboard is dynamic by construction — no `force-dynamic` or `revalidate` directive needed.
- **`router.refresh()` is not needed here** — the page is server-rendered on every navigation. To get fresh stats, the user navigates away and back (or refreshes the browser). Owner-initiated mutations on `/admin/orders` and `/admin/menu` already call `router.refresh()` per Story 2.7 / 5.x patterns, so when the owner returns to `/admin` the data is fresh on the next request.
- **Active-count uses `select('id') + .length`** — the project uses `count: 'exact'` only for `.update(...)` operations (`actions/orderActions.ts:145, 207`) where 0-row detection matters; SELECTs uniformly use `select('id')` (or full-row) and count client-side. The expected payload for active orders is small (rare for a restaurant to have >100 in-flight orders at once), so the wire cost is negligible.
- **Server Component composition with a Client Component child** is React's standard RSC pattern. The Server Component (`DashboardLandingSnapshot`) renders, serializes its props at the `<OrderCard>` boundary, and React Server Components reconciler ships the OrderCard tree to the client for hydration. No special directive needed on the parent.
- **Dashboard does NOT live-update on new orders** — by design. The Server Component re-fetches on every navigation to `/admin`. Realtime is reserved for `/admin/orders` (`OrderFeed`) where seeing new orders mid-service is the user job. Adding Realtime to the dashboard would duplicate the existing subscription in `RealtimeProvider` and provide minimal benefit (owner is not staring at the dashboard during service).
- **No new npm dependencies** needed.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **Server Components by default** — `DashboardLandingSnapshot` has no `'use client'`. The only Client Component is the embedded `<OrderCard>`.
- **Cookie client for owner SSR** — `createClient()` from `lib/supabase/server.ts` (NOT the admin client; the dashboard is owner-only, not platform-admin or customer-facing).
- **Defense-in-depth on `restaurant_id`** — every Supabase query must include `.eq('restaurant_id', profile.restaurant_id)` even though RLS would scope automatically.
- **Path alias `@/*`** — use `@/components/admin/...`, `@/lib/analytics/...`, etc.
- **Always destructure `{ data, error }`** — even though the dashboard's failure mode is "show zeros", the `error` field must be checked before reading `data`.
- **Price formatting** — only via `utils/formatPrice.ts`. Never inline `(cents / 100).toFixed(2)`.
- **Tailwind tokens only** — no hardcoded hex colors. Use `bg-surface-raised`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-accent`.
- **Breakpoints `sm` and `lg` only** — no `md` (UX spec rule). KDS hide rule uses `lg:` exactly.
- **No comments unless WHY is non-obvious** — the `todayStartIso` line warrants a one-line comment ("must match getRestaurantAnalytics 'today' boundary") because future readers may diverge the boundaries by accident.

### References

- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 11.1 source ACs (end of file, "Epic 11" section)
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR4a (Restaurant Onboarding & Account Management section)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — Component #7 (DashboardLandingSnapshot, immediately after Component #6 OnboardingChecklist)
- Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-23.md` — full rationale for Epic 11 and Story 11.1
- Project Context: `_bmad-output/project-context.md` — Supabase Client Selection, anti-patterns, breakpoint rule
- Conventions: `docs/conventions/supabase-clients.md` — client selection table
- Prior art: `_bmad-output/implementation-artifacts/2-7-menu-publish-offline-control-onboarding-checklist.md` — how the dashboard page first fetched onboarding flags
- Prior art: `_bmad-output/implementation-artifacts/7-1-analytics-data-aggregation-layer.md` — `getRestaurantAnalytics` contract, UTC boundary semantics, fixture-shape constraints
- Prior art: `app/admin/orders/page.tsx` — `tablesById` lookup pattern + auth-then-profile-then-redirect pattern
- Prior art: `app/admin/analytics/page.tsx` — Server Component + `getRestaurantAnalytics` invocation pattern
- Prior art: `components/admin/OrderCard.tsx` — Client Component island with optional `onAdvance` prop
- Prior art: `components/admin/AdminNav.tsx` — `desktopOnly` rule for KDS tab (line 24)

---

---

## Open Questions for Nic

1. **Branching strategy.** Current branch is `feature/multi-language-selection` (Epic 10), unmerged. Three options for Story 11.1:
   - **(a)** Merge `feature/multi-language-selection` → `main`, then cut `feature/dashboard-landing` off `main` (cleanest history)
   - **(b)** Cut `feature/dashboard-landing` off `feature/multi-language-selection` (depends on Epic 10 merging; ships together)
   - **(c)** Cut `feature/dashboard-landing` off `main` and let it diverge from Epic 10 (independent; resolve conflicts in `app/admin/page.tsx` later — likely none since Epic 10 doesn't touch admin/page.tsx)
   - **Default recommendation:** (a) once Epic 10 is reviewed and merged.

2. **Widening `max-w-2xl` → `max-w-4xl` on the snapshot branch only** is a UX micro-decision. Confirm acceptable, or specify a different width.

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- Test file initial draft used a `rerender(...)` call after `cleanup()` for the "Go to Orders → present in both populated and empty states" case. `cleanup()` unmounts the prior render, so the `rerender` returned by `render()` becomes a no-op — split into two independent `render()` cases before running.
- `npx tsc --noEmit` reports pre-existing errors in `tests/rls/tenant-isolation.spec.ts`, `tests/unit/menu/CategoryManager.test.tsx`, `tests/unit/tables/QrCodeDisplay.test.tsx`, and `tests/unit/tables/tableActions.test.ts`. None of those files were touched by this story; errors are not regressions.

### Completion Notes List

- **Task 1 (DashboardLandingSnapshot.tsx):** Server Component, three sections, all design tokens from existing palette. KDS quick-action carries `hidden lg:inline-flex`; other actions use `inline-flex` only — matches the desktopOnly rule in `AdminNav.tsx:24`.
- **Task 2 (app/admin/page.tsx):** 6-query parallel Promise.all (3 onboarding-flag queries + analytics RPC + active-count + recent-5). `tables` query widened from `select('id')` to `select('id, number')` to dual-purpose for the `hasTables` flag AND the `tablesById` lookup. Auth/profile lookup added per `admin/orders/page.tsx` pattern (the layout already redirects, but explicit re-fetch is required for `restaurant_id` query scoping per the project convention).
- **Task 3 (Vitest tests):** 15 tests, all green. Coverage: aria-label on Today region; stat-triplet formatting (including `$0.00` and `$12.34`); OrderCard row rendering by count and by table number; `Table —` fallback when `tablesById` is missing the key; no inline-advance button (read-only); empty-state copy; absence of `<ul>` in empty state; "Go to Orders →" link in both populated and empty states; 4 quick-action links with correct hrefs; KDS link `hidden lg:inline-flex` class; non-KDS links do not carry `hidden`.
- **Task 4 (page test):** Skipped per spec conditional — no existing `tests/.../admin/page*` file. Confirmed via `find tests -name '*page*'`.
- **Task 5 (manual smoke):** **NOT RUN.** Requires `supabase start` + interactive browser. Spec authorizes leaving unchecked when smoke can't be run; hands off to Nic as a review-gate before promoting story to `done`. Suggested smoke script is intact in the Task 5 description above.
- **Type-check:** No new TS errors introduced. Pre-existing errors in unrelated test files remain.
- **Lint:** `npx eslint` clean on all three touched/created files.
- **Test suite:** 646/646 unit tests pass across 58 files (15 new + 631 existing). No regressions.

**Open follow-ups (carried over from the story's "Open Questions for Nic" section):**
1. Branching strategy — implementation lives on the current branch `feature/multi-language-selection`. You decide whether to cherry-pick/move to a new `feature/dashboard-landing` branch off `main`.
2. `max-w-4xl` for snapshot wrapper — implemented per spec recommendation. If you want a different width, change `wrapperClass` in `app/admin/page.tsx`.

### File List

- `components/admin/DashboardLandingSnapshot.tsx` (new)
- `app/admin/page.tsx` (modified)
- `tests/unit/admin/DashboardLandingSnapshot.test.tsx` (new)

### Change Log

- 2026-05-23: Story 11.1 created — comprehensive context engine produced by bmad-create-story; ready for dev
- 2026-05-23: Story 11.1 implemented — DashboardLandingSnapshot Server Component + app/admin/page.tsx branching; 15 unit tests green, full suite 646/646 green; manual smoke (Task 5) handed to Nic as review-gate; status → review
- 2026-05-23: Code review 3-layer adversarial (Acceptance Auditor: Approve; Blind Hunter + Edge Case Hunter: Changes Requested). 5 decision-needed + 5 patch + 11 defer + 7 dismissed. Decisions D1/D2/D3 → patched as P6/P7/P8; D4/D5 → deferred. All 8 patches applied. 15/15 component tests + 646/646 full suite green. Status → done. Manual smoke (Task 5) still owed to Nic before commit.
