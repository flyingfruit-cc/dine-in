# Story 7.2: Order Volume & Peak Hours Visualization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to see how many orders I'm handling and when peak hours hit,
so that I can plan staffing and prep.

## Acceptance Criteria

1. **Given** an authenticated owner navigates to `/admin/analytics`
   **When** the page renders
   **Then** a period selector (Today / 7 days / 30 days / 90 days) appears at the top
   **And** an "Order Volume" chart shows orders per day for the selected period (one bar per day; "Today" collapses to a single-bar chart)
   **And** a "Peak Hours" heatmap shows day-of-week (rows) × hour-of-day (cols), with cell intensity proportional to order count

2. **Given** an owner switches the period selector
   **When** the new selection is registered
   **Then** the URL search param `?period=7d` (or `today`/`30d`/`90d`) reflects the selection so the view is shareable/bookmarkable
   **And** the page re-renders with the new aggregation
   **And** a route-level `loading.tsx` skeleton matches the chart layout exactly (same chart heights, same heatmap grid dimensions) — no spinners (UX-DR12)

3. **Given** the URL contains no `period` param (first visit)
   **When** the page loads
   **Then** the default period is `7d`
   **And** invalid/unknown `?period=` values fall back to `7d` (do not crash the page)

4. **Given** `getRestaurantAnalytics` returns `emptyState: true` (fewer than 30 orders in the period)
   **When** the page renders
   **Then** both charts are replaced by an empty-state panel: heading "Not enough data yet — keep serving!" + body "Come back when you have ≥30 orders" — no sparse / misleading graphs (matches Story 7.1 AC #2 contract)

5. **Given** `getRestaurantAnalytics` returns `error: true` (RPC outage path, distinct from emptyState)
   **When** the page renders
   **Then** an "Analytics temporarily unavailable — please refresh in a moment" panel is shown in place of the charts (UX distinct from the "no orders yet" empty state per Story 7.1 D4)

6. **Given** the AdminNav is mounted on any admin page
   **When** the nav renders
   **Then** an "Analytics" entry exists (icon: `BarChart3` from `lucide-react`) appearing in BOTH the desktop sidebar AND the mobile bottom tab bar; navigation order: Dashboard, Orders, Menu, Tables, Analytics, Settings; clicking it routes to `/admin/analytics`

7. **Given** the charting approach
   **When** evaluating implementation
   **Then** use **native SVG** for both charts — no new dependency added. Justification: project-context "Ask First" rule for new deps, Cloudflare Workers / edge-runtime compatibility risk avoidance, ~80 LOC per chart is achievable with full a11y control. (If during implementation native SVG proves clearly inadequate, halt and ask before adding `recharts` or `visx`.)

8. **Given** an owner views the heatmap
   **When** intensity is computed
   **Then** the color ramp uses Tailwind opacity steps of the `accent` token (e.g. `bg-accent/10` … `bg-accent/100`) so the design palette is preserved — no hardcoded hex; zero-count cells get a low contrast neutral fill (`bg-surface-overlay`) and an `aria-label="No orders"`; non-zero cells get `aria-label="N orders on <DayName> at HH:00 UTC"`

9. **Given** the owner is on a non-UTC locale
   **When** day-of-week and hour labels render
   **Then** labels read as UTC (e.g. "Sun"/"00:00") with a small footnote "All times shown in UTC" — restaurant-local timezone is deferred per Story 7.1 Dev Notes; do not invent a timezone here

---

## Tasks / Subtasks

- [x] **Task 1 — Add the `/admin/analytics` route segment with default period handling** (AC: #1, #3)
  - [x] Create `app/admin/analytics/page.tsx` (Server Component) following the established pattern in `app/admin/orders/page.tsx`:
    - `const supabase = await createClient()` from `@/lib/supabase/server`
    - `await supabase.auth.getUser()` → `redirect('/auth/login')` if no user
    - Fetch `profile.restaurant_id` from `profiles` → `redirect('/auth/onboarding')` if missing
  - [x] Page signature: `export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> })` — Next.js 15 requires `await searchParams` (matches `app/auth/error/page.tsx` pattern)
  - [x] Normalize `period`: if `searchParams.period` is one of `'today' | '7d' | '30d' | '90d'`, use it; otherwise fall back to `'7d'`. Do **not** trust the raw string — pass it through a guard. Export a small `parsePeriodParam(raw: string | undefined): AnalyticsPeriod` helper at the top of the page file (or inline) so both the server component and tests can use it
  - [x] Call `await getRestaurantAnalytics(supabase, profile.restaurant_id, period)` once — single round-trip per page render (Story 7.1 contract)
  - [x] Render `<main>` with header "Analytics", `<AnalyticsPeriodSelector currentPeriod={period} />`, then conditional body:
    - If `data.error` → `<AnalyticsErrorPanel />`
    - Else if `data.emptyState` → `<AnalyticsEmptyState />`
    - Else → `<AnalyticsOrderVolumeChart data={data.ordersByDay} period={period} />` followed by `<AnalyticsPeakHoursHeatmap data={data.ordersByDowHour} />`
  - [x] Footnote text "All times shown in UTC" appears once below the heatmap (or once at the bottom of the page if both charts use UTC)

- [x] **Task 2 — Create route-level loading skeleton** (AC: #2)
  - [x] Create `app/admin/analytics/loading.tsx` (Next.js route-segment loading file — auto-wraps the page in `<Suspense>`)
  - [x] Skeleton must match the rendered page's layout exactly:
    - Period-selector chip row (4 chip-shaped skeleton bars, ~32px tall, rounded-full)
    - Order Volume chart placeholder (full-width, ~240px tall)
    - Peak Hours heatmap placeholder (7 rows × 24 cols, same cell size as the real heatmap)
  - [x] Use `animate-pulse` with `bg-surface-overlay` — matches `components/customer/MenuSkeleton.tsx` pattern
  - [x] No spinners anywhere on this page (UX-DR12)

- [x] **Task 3 — `AnalyticsPeriodSelector` (Client Component, URL-driven)** (AC: #1, #2)
  - [x] Create `components/admin/AnalyticsPeriodSelector.tsx` with `'use client'`
  - [x] Props: `{ currentPeriod: AnalyticsPeriod }`
  - [x] Renders four pill buttons: "Today", "7 days", "30 days", "90 days"
  - [x] Active pill: `bg-accent-muted text-accent` border-2 border-accent. Inactive: `text-text-secondary hover:text-text-primary` border-border
  - [x] On click: `useRouter().push(`/admin/analytics?period=${nextPeriod}`)` and `useRouter()` from `next/navigation` — Next.js 15 client-side navigation auto-triggers Suspense skeleton via `loading.tsx`
  - [x] Container: horizontal `flex gap-2` on mobile, same on desktop; wraps under 360px if needed (use `flex-wrap`)
  - [x] `role="tablist"` on the container, each button `role="tab" aria-selected={currentPeriod === thisPeriod}` — matches existing tab-bar pattern from `components/admin/OrderFeed.tsx`

- [x] **Task 4 — `AnalyticsOrderVolumeChart` (Server Component, native SVG)** (AC: #1, #7)
  - [x] Create `components/admin/AnalyticsOrderVolumeChart.tsx` (no `'use client'` — pure presentation, no interactivity)
  - [x] Props: `{ data: OrdersByDay[]; period: AnalyticsPeriod }`
  - [x] Render an inline `<svg>` with `viewBox="0 0 320 240"` and `className="w-full h-60"` (responsive width, fixed aspect ratio)
  - [x] Layout: bars span the chart width with 4px gaps; max bar height ~180px; bottom 30px reserved for x-axis date labels; top 30px for the value labels above each bar (only when there are ≤14 bars; otherwise skip per-bar labels to avoid clutter)
  - [x] Compute `maxCount = Math.max(...data.map(d => d.count), 1)` to avoid div-by-zero when emptyState boundary is just-crossed (`maxCount` of 1 means a single bar at full height — acceptable)
  - [x] Bar fill: `fill-accent` (use Tailwind class on `<rect>` — verify it cascades through SVG; if not, use `fill="currentColor"` and put `text-accent` on the parent group)
  - [x] X-axis label format: for `today`/`7d`, show `MM/DD`; for `30d`/`90d`, show every Nth label (~ every 5–7 days) to avoid overlap — derive N from `Math.ceil(data.length / 12)`
  - [x] Accessibility: outer `<svg role="img" aria-label="Order volume bar chart: total <sum> orders across <data.length> days">`; each bar has `<title>day: count orders</title>` for native SVG tooltips
  - [x] If `data.length === 0` (defensive — should not happen when `emptyState=false`), render a minimal "No orders in this period" line and return early

- [x] **Task 5 — `AnalyticsPeakHoursHeatmap` (Server Component, native SVG or HTML grid)** (AC: #1, #8, #9)
  - [x] Create `components/admin/AnalyticsPeakHoursHeatmap.tsx`
  - [x] Props: `{ data: OrdersByDowHour[] }`
  - [x] Build a 7×24 lookup map from the data: `Map<string, number>` keyed by `${dow}-${hour}` → count
  - [x] Render as HTML grid (CSS `grid-cols-25 grid-rows-8`) with day labels in the first column (Sun, Mon, Tue, Wed, Thu, Fri, Sat — `dow=0` is Sunday) and hour labels in the first row (00, 01, … 23). HTML grid is preferred over SVG here because the cell-per-cell aria-labels and keyboard focus work natively
  - [x] Compute `maxCount = Math.max(...data.map(d => d.count), 1)` once
  - [x] For each cell: opacity step = `Math.ceil((count / maxCount) * 10) * 10` → maps to Tailwind classes `bg-accent/10` … `bg-accent/100` (define a static lookup array; don't dynamically interpolate Tailwind classes — Tailwind purger won't see them. Use a literal array: `['bg-accent/0', 'bg-accent/10', 'bg-accent/20', …, 'bg-accent/100']`)
  - [x] Zero-count cells: `bg-surface-overlay` (low neutral contrast), `aria-label="No orders on <DayName> at HH:00 UTC"`
  - [x] Non-zero cells: `bg-accent/<opacity>`, `aria-label="<count> orders on <DayName> at HH:00 UTC"`
  - [x] Cell minimum size: 12×12px on mobile, 18×18px on desktop (use `min-w-3 min-h-3 sm:min-w-4 sm:min-h-4`)
  - [x] Display footnote below the heatmap: small text-text-secondary "All times shown in UTC"

- [x] **Task 6 — `AnalyticsEmptyState` + `AnalyticsErrorPanel`** (AC: #4, #5)
  - [x] Create `components/admin/AnalyticsEmptyState.tsx`
    - Props: `{ orderCount: number }` (so copy can read "X orders so far / 30 needed" — optional polish)
    - Centered panel: heading "Not enough data yet — keep serving!" (text-lg font-semibold), body "Come back when you have ≥30 orders" (text-text-secondary)
    - No icon; quiet design (UX rule: empty states are encouraging, not decorative)
  - [x] Create `components/admin/AnalyticsErrorPanel.tsx`
    - Centered panel: heading "Analytics temporarily unavailable" (text-lg font-semibold), body "Please refresh in a moment" (text-text-secondary)
    - No retry button — server re-renders on next navigation; consistent with sessionless customer flow's "Tap to try again" simplicity (just reload the route)

- [x] **Task 7 — Add Analytics entry to `AdminNav`** (AC: #6)
  - [x] Edit `components/admin/AdminNav.tsx`:
    - Import `BarChart3` from `lucide-react` (existing dep — no new package)
    - Add a new entry to the `tabs` array between Tables and Settings: `{ href: '/admin/analytics', label: 'Analytics', icon: BarChart3, exact: false }`
    - The mobile bottom bar already uses `flex flex-1` so it auto-balances; verify the new 6-item-plus-sign-out (7 total) layout fits at 360px — each entry gets ~51px, label "Analytics" (9 chars at text-xs) fits. If it overflows visually on a test device, defer the fix to a UI polish story; do not redesign the nav here
  - [x] No URL/route changes needed for other surfaces — the layout already nests via `app/admin/layout.tsx`

- [x] **Task 8 — Unit tests for `parsePeriodParam`, charts, selector** (AC: #1, #3, #4, #5)
  - [x] `tests/unit/admin/analytics/parsePeriodParam.test.ts` (or inline in the page test): valid periods accepted, invalid string defaults to `7d`, `undefined` defaults to `7d`, empty string defaults to `7d`
  - [x] `tests/unit/admin/analytics/AnalyticsPeriodSelector.test.tsx`:
    - Renders all four pill buttons
    - The `currentPeriod` button has `aria-selected="true"` and accent styling
    - Clicking a different period calls `router.push('/admin/analytics?period=...')` (mock `useRouter`)
  - [x] `tests/unit/admin/analytics/AnalyticsOrderVolumeChart.test.tsx`:
    - Renders one `<rect>` per data point
    - Total `aria-label` mentions order count
    - `maxCount=1` for a single-bar dataset (today with one order) — no div-by-zero
    - Empty data renders the defensive "No orders" line without crashing
  - [x] `tests/unit/admin/analytics/AnalyticsPeakHoursHeatmap.test.tsx`:
    - 7×24 grid renders even when data is sparse (e.g. only 3 buckets — verify zero-cells are filled with `bg-surface-overlay`)
    - Cell opacity classes pulled from the static lookup array (not dynamically interpolated)
    - aria-labels distinguish "No orders" from "<count> orders"
  - [x] `tests/unit/admin/analytics/AnalyticsEmptyState.test.tsx` + `AnalyticsErrorPanel.test.tsx`: render the right heading copy
  - [x] Update `tests/unit/admin/AdminNav.test.tsx` (or create one if missing) to assert "Analytics" entry exists in both mobile and desktop renders

- [x] **Task 9 — E2E smoke test for the page** (AC: #1, #2, #3, #6)
  - [x] Add `tests/e2e/admin-analytics.spec.ts` (Playwright, E2E layer — hits real local Supabase):
    - Sign in as a test owner created via `tests/rls/helpers.ts` (the helpers are shared between rls/ and e2e/ — verify the import path)
    - Navigate to `/admin/analytics` → expect the page title "Analytics" to be visible
    - Initial URL has no `?period=` → expect `aria-selected="true"` on the "7 days" pill
    - Click "30 days" pill → expect URL to contain `?period=30d`
    - Verify either the empty-state panel ("Not enough data yet") or the charts render (depending on whether the test owner has seeded orders — the test should assert the page renders SOMETHING, not crash)
  - [x] No assertion on chart pixel layout — the chart visual is exercised via the unit tests; E2E confirms the page loads, the nav entry routes, and the period selector writes the URL

- [ ] **Task 10 — Verification: manual visual check + accessibility audit**
  - [ ] Start the dev server (`npm run dev`), sign in as a test owner with seeded analytics data, visit `/admin/analytics`
  - [ ] Check all four period values produce a non-broken render (today often has 0 orders → empty state expected)
  - [ ] Tab through the page — confirm period selector pills are keyboard-focusable, heatmap cells are reachable (or skipped via a `tabindex="-1"`), and aria-labels read sensibly via a screen reader (VoiceOver on macOS suffices)
  - [ ] Verify mobile layout at 360px width — period selector wraps cleanly, heatmap horizontally scrolls if needed, no horizontal scroll on the main page

---

## Dev Notes

### Critical Context

**This story is the first owner-facing analytics surface.** It depends on Story 7.1's `getRestaurantAnalytics` helper and the `AnalyticsData` contract. Read Story 7.1's file (`_bmad-output/implementation-artifacts/7-1-analytics-data-aggregation-layer.md`) before starting — especially the "Naming compliance" rename to camelCase `revenueCents`, the `error?: boolean` flag, and the `emptyState` semantics (arrays are suppressed when `orderCount < 30`).

**No new charting dependency.** The decision is native SVG. Reasons:
1. Project-context "Ask First" rule for new deps (`recharts`, `visx`, etc.)
2. Cloudflare Workers / edge-runtime compatibility risk avoidance — verifying a chart library for `@opennextjs/cloudflare` is a story on its own
3. Two simple charts (bars + heatmap) are <100 LOC each in native SVG with full a11y control
4. Bundle weight: zero (saves ~80–100 KB gzipped that `recharts` would add)
5. The empty-state and error states do not render a chart at all — so the chart layer's complexity is even lower than it looks

If the dev hits a clear limitation (e.g. animation requirements not in the AC, or a complex axis/tick math that doesn't fit native SVG cleanly), **halt and ask** before installing a library.

**Period selector writes to URL — server reads `searchParams`.** This is a stateless contract: the URL is the source of truth. The client component does `router.push()` with the new query; the server component re-renders with the new `searchParams.period`. No Zustand store. No client-side data fetching.

**`loading.tsx` is mandatory.** Without it, period changes cause a blank flash (Next.js doesn't auto-skeleton between server renders). The skeleton at `app/admin/analytics/loading.tsx` is route-segment-scoped — it activates automatically when navigation to or within the segment is in flight.

**emptyState vs error vs zero-data — three distinct UX outcomes:**
| Helper return | Page renders |
|---|---|
| `error: true` (RPC failed or invalid restaurantId) | `<AnalyticsErrorPanel />` |
| `emptyState: true` AND `error` undefined (orderCount < 30) | `<AnalyticsEmptyState />` |
| `emptyState: false` | Charts |

The order of checks matters: `error` is checked **before** `emptyState` because the error path also sets `emptyState: true`. Story 7.1's `error?: boolean` flag was added precisely to allow this distinction.

**Charting is presentation-only.** All three chart-related components (`AnalyticsOrderVolumeChart`, `AnalyticsPeakHoursHeatmap`, `AnalyticsEmptyState`, `AnalyticsErrorPanel`) are **Server Components** by default — no `'use client'`, no event handlers, no hooks. The only Client Component on this page is `AnalyticsPeriodSelector`.

**UTC is the contract.** All day labels and hour labels are UTC. Story 7.1's SQL function explicitly uses `AT TIME ZONE 'UTC'` for `date_trunc` and `EXTRACT`. Do not invent a "best-effort restaurant local time" here — that's a future story, deliberately deferred.

**Tailwind opacity classes for the heatmap MUST be statically declared.** Tailwind's purger reads class names from source code at build time. Dynamically interpolated classes like `bg-accent/${opacity}` are stripped. Define a fixed lookup array at the top of `AnalyticsPeakHoursHeatmap.tsx`:

```ts
const HEATMAP_OPACITY_CLASSES = [
  'bg-accent/0',  // unused; reserved for explicit zero
  'bg-accent/10', 'bg-accent/20', 'bg-accent/30', 'bg-accent/40',
  'bg-accent/50', 'bg-accent/60', 'bg-accent/70', 'bg-accent/80',
  'bg-accent/90', 'bg-accent/100',
] as const
```

These literal strings are visible to Tailwind. Index them by `Math.round((count / maxCount) * 10)` — the result is 0–10.

### Architecture Compliance

**Routing:**
- New route `app/admin/analytics/` is a server-component segment (matches Orders, Tables, Menu)
- The Admin layout (`app/admin/layout.tsx`) already gates by auth and profile.restaurant_id — page-level checks are belt-and-braces but match the existing pattern

**Client selection** (see `docs/conventions/supabase-clients.md`):
- Page uses the **server cookie client** (`@/lib/supabase/server`) — owner identity from JWT, RLS-protected
- Helper `getRestaurantAnalytics` accepts any client — the page passes the cookie client
- Story 6.2's platform admin path would pass the admin client; that's a future increment, out of scope for 7.2

**Server Action discipline doesn't apply** — this story has no Server Actions. All reads. The period change is a URL navigation, not a Server Action.

**Naming compliance:**
- Components: PascalCase — `AnalyticsPeriodSelector`, `AnalyticsOrderVolumeChart`, etc.
- Route file: `app/admin/analytics/page.tsx` (kebab/lower per Next.js convention)
- New directory `tests/unit/admin/analytics/` parallels the source structure
- All filenames are camelCase / PascalCase per project convention

**Price discipline:**
- 7.2 itself doesn't render prices — revenue is in 7.3
- The `OrdersByDay.revenueCents` field is available but not displayed by this story; do **not** add a revenue bar overlay here (that's 7.3 scope)
- If you do need to display any cents value in a tooltip during implementation: route through `utils/formatPrice.ts`

**Styling rules:**
- Tailwind only — no CSS-in-JS, no inline `style=` for layout (one exception: `style="width: {percent}%"` for bar inner widths in SVG is acceptable since Tailwind can't express dynamic percentages)
- Design tokens: `bg-accent`, `bg-accent-muted`, `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `text-text-primary`, `text-text-secondary`, `border-border` — all already in `tailwind.config.ts`
- No hardcoded hex anywhere — heatmap intensities use `accent` opacity steps

**Anti-patterns to avoid:**
- Do **not** install a chart library without halting and asking
- Do **not** put data fetching in a Client Component — server fetches, client navigates
- Do **not** use `useEffect` to refetch on period change — URL navigation triggers server re-render
- Do **not** dynamically interpolate Tailwind opacity classes — Tailwind's static purger will strip them; use the literal lookup array
- Do **not** add `Sentry.captureException` calls in this page — `console.error` from the helper is already captured by the instrumentation hook
- Do **not** render anything outside `<main>` — match the existing orders/tables/menu pages

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`app/admin/orders/page.tsx`** — the template Server Component pattern for an owner admin page:
- `const supabase = await createClient()` from `lib/supabase/server`
- `auth.getUser()` redirect, profile.restaurant_id redirect
- Fetches data via Supabase
- Renders `<main className="min-h-screen bg-surface-base">` with a header section and the feature body
- What you preserve: the auth/profile gate sequence, the `<main>` shell, the redirect targets
- What you change: data source (RPC instead of `from()`), body (charts/empty-state/error instead of OrderFeed)

**`app/admin/layout.tsx`** — wraps every admin page in `RealtimeProvider`:
- Analytics page does not need realtime subscriptions, but the provider runs regardless — fine, just inert for this surface
- The layout already redirects unauthenticated users; the page-level redirect is defense-in-depth (matches existing pattern)

**`components/admin/AdminNav.tsx`** — the file Task 7 modifies:
- `tabs` array drives both the mobile bottom bar AND the desktop sidebar — adding one entry updates both surfaces simultaneously
- Active state styling: `bg-accent-muted text-accent` (sidebar) and `text-accent` (mobile bar)
- The `exact: false` flag means the active class fires on `/admin/analytics` AND any sub-route — analytics has no sub-routes today, but `exact: false` keeps it future-proof
- What you must preserve: the structure of both nav blocks, the sign-out button position, the icon stroke-width logic (`active ? 2 : 1.5`)

**`components/customer/MenuSkeleton.tsx`** — canonical `animate-pulse` skeleton pattern:
- Uses `bg-surface-overlay` rounded shapes
- No external dep; pure Tailwind
- Match this aesthetic for `app/admin/analytics/loading.tsx`

**`components/admin/OrderFeed.tsx`** — reference for the tab/pill UI pattern in `AnalyticsPeriodSelector`:
- `role="tablist"` on the container, `role="tab"` + `aria-selected` per pill
- Active/inactive styling already established for the project

**`lib/analytics/getRestaurantAnalytics.ts`** — Story 7.1 helper (the data source):
- Signature: `(supabase, restaurantId, period: AnalyticsPeriod) => Promise<AnalyticsData>`
- Returns `{ period, periodStart, periodEnd, orderCount, totalRevenueCents, averageOrderValueCents, ordersByDay, ordersByDowHour, topItems, emptyState, error? }`
- Never throws. On error, returns all-zero state with `error: true`. On rows < 30, returns all-zero arrays with `emptyState: true` and no `error` flag.

**`types/app.ts`** — type contracts:
- `AnalyticsPeriod = 'today' | '7d' | '30d' | '90d'`
- `OrdersByDay = { day: string; count: number; revenueCents: number }` (camelCase per Story 7.1 D2)
- `OrdersByDowHour = { dow: number; hour: number; count: number }`
- `AnalyticsData = { …; emptyState: boolean; error?: boolean }`

**`auth/error/page.tsx`** — reference for the Next.js 15 `searchParams: Promise<{…}>` pattern:
- `await searchParams` before destructuring
- Type the prop precisely; do not use `any`

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `app/admin/analytics/page.tsx` | NEW | Server Component; auth + profile gate; RPC; conditional render |
| `app/admin/analytics/loading.tsx` | NEW | Route-segment skeleton matching final layout |
| `components/admin/AnalyticsPeriodSelector.tsx` | NEW | Client Component; URL writer |
| `components/admin/AnalyticsOrderVolumeChart.tsx` | NEW | Server Component; native SVG bars |
| `components/admin/AnalyticsPeakHoursHeatmap.tsx` | NEW | Server Component; HTML grid with Tailwind opacity ramp |
| `components/admin/AnalyticsEmptyState.tsx` | NEW | Server Component; "Not enough data yet" copy |
| `components/admin/AnalyticsErrorPanel.tsx` | NEW | Server Component; "Analytics temporarily unavailable" copy |
| `components/admin/AdminNav.tsx` | UPDATE | Add Analytics entry between Tables and Settings |
| `tests/unit/admin/analytics/parsePeriodParam.test.ts` | NEW | Period normalization edges |
| `tests/unit/admin/analytics/AnalyticsPeriodSelector.test.tsx` | NEW | Routing + a11y |
| `tests/unit/admin/analytics/AnalyticsOrderVolumeChart.test.tsx` | NEW | Bars, aria, edge cases |
| `tests/unit/admin/analytics/AnalyticsPeakHoursHeatmap.test.tsx` | NEW | Grid, opacity lookup, aria |
| `tests/unit/admin/analytics/AnalyticsEmptyState.test.tsx` | NEW | Copy assertion |
| `tests/unit/admin/analytics/AnalyticsErrorPanel.test.tsx` | NEW | Copy assertion |
| `tests/unit/admin/AdminNav.test.tsx` | NEW or UPDATE | Verify Analytics entry exists (mobile + desktop renders) |
| `tests/e2e/admin-analytics.spec.ts` | NEW | Page load + period URL write + nav routing |

### Testing Standards

**Three test layers — three runners (project-context rule):**

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/analytics/` + `tests/unit/admin/AdminNav.test.tsx` | Vitest (`npm run test`) | Charts, selector, period parser, nav |
| RLS integration | n/a | — | **Not used** — no new DB access patterns here; 7.1 already covers RLS |
| E2E | `tests/e2e/admin-analytics.spec.ts` | Playwright (`npm run test:e2e`) | Page renders, period selector writes URL, nav routes |

- Vitest jsdom environment will handle the SVG `<rect>` / HTML grid rendering — no headless browser needed for unit tests
- Mock `getRestaurantAnalytics` in the page unit test (if a page test is added) via `vi.mock('@/lib/analytics/getRestaurantAnalytics')`
- For chart unit tests, pass synthetic `OrdersByDay[]` / `OrdersByDowHour[]` arrays directly — no Supabase mocking needed
- For the period-selector test, mock `next/navigation`'s `useRouter` via `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))`

### Previous Story Intelligence (from Story 7.1)

- **`AnalyticsData.error?: boolean`** flag exists and is set on the RPC-error path. The page must check `error` before `emptyState` — both are `true` when an error occurs.
- **camelCase nested fields**: `OrdersByDay.revenueCents` (not `revenue_cents`); `TopItem.revenueCents` (not `revenue_cents`). The helper remaps the SQL snake_case keys.
- **Aggregate arrays are empty when `emptyState=true`** — the helper suppresses them per AC #2 (D1 decision). So if `emptyState=true`, do not attempt to render the charts (defensive: `ordersByDay.length === 0`); use the empty-state panel.
- **`top_items LIMIT 50`** in the SQL function (D3 decision) — irrelevant for 7.2, but means 7.3 can sort by either axis without losing data. Don't worry about it here.
- **UTC pinning**: SQL function uses `AT TIME ZONE 'UTC'` for `date_trunc` and `EXTRACT` — your labels are UTC-accurate, do not re-shift them in TS.
- **Helper accepts any `SupabaseClient`** — pass the cookie client from the page; do not import `createAdminClient` here.

### Latest Tech Information

- **`recharts` latest is 2.x** — works in Next.js 15 SSR, has typed API, but bundle is ~95 KB gzipped. Not used.
- **`visx` latest is 3.x** — lower-level primitives; bundle is smaller per chart but verbose. Not used.
- **`lucide-react`** already provides `BarChart3` icon — no addition needed. Verify with `import { BarChart3 } from 'lucide-react'`.
- **Next.js 15 `loading.tsx`** is the canonical route-segment skeleton. Auto-wraps the segment in `<Suspense>` with the loading file as the fallback. Works with `searchParams` navigation (period change re-runs the server segment).
- **Native SVG accessibility**: `role="img"`, `aria-label` on the root `<svg>`; child `<title>` elements provide native tooltips. No external a11y library needed.
- **Tailwind opacity utilities (`/10`, `/20`, …)**: Tailwind 3.4+ supports `bg-accent/<n>` arbitrary opacity. Confirmed in `tailwind.config.ts` (the `accent` token is defined). The class list MUST be statically literal — see Dev Notes for the lookup array pattern.

### Git Intelligence Summary

Recent commits closed Epic 6 and shipped Story 7.1 (analytics aggregation layer + code-review patches). The pattern most relevant to 7.2 is Story 7.1's "client-agnostic helper + caller chooses client" decision — replicated here by having the page choose the cookie client and pass it to `getRestaurantAnalytics`. The `app/admin/orders/page.tsx` pattern (auth → profile.restaurant_id → fetch → render) is the closest existing analogue for the new page shell.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **No new dependencies without asking** — relevant because the dev's first instinct may be to reach for `recharts`. Native SVG is the chosen path; halt and ask only if a clear, narrow limitation appears.
- **Path alias `@/*`** — use `@/components/admin/AnalyticsPeriodSelector`, `@/lib/analytics/getRestaurantAnalytics`, etc.; never `../`.
- **Server Components by default** — only `AnalyticsPeriodSelector` gets `'use client'`; everything else stays server-side.
- **Tailwind only, design tokens only** — no inline hex, no CSS-in-JS, no custom CSS files.
- **`searchParams` in Next.js 15 is a Promise** — `await searchParams` before reading.
- **No spinners (UX-DR12)** — loading state is always a skeleton matching the final layout.
- **Server-only modules use `import 'server-only'`** — not relevant here (no admin client usage), but worth knowing for future analytics pages that may use the admin client.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — sparse on chart/analytics UI; this story carries the design decisions in Dev Notes
- Epics: `_bmad-output/planning-artifacts/epics.md#Story-7.2` (lines 1020–1047) — source ACs
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR45–FR48 (Post-MVP analytics)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR12 (no spinners; skeletons match layout); no explicit analytics screen spec — design choices live in this story
- Project Context: `_bmad-output/project-context.md` — Technology Stack, Server-Component-first rules, Tailwind discipline, "Ask First" for new deps
- Prior art: `_bmad-output/implementation-artifacts/7-1-analytics-data-aggregation-layer.md` — the data contract this story consumes
- Prior art: `app/admin/orders/page.tsx` — admin server-component page shell
- Prior art: `components/customer/MenuSkeleton.tsx` — skeleton aesthetic
- Prior art: `components/admin/OrderFeed.tsx` — tab/pill UI pattern for the period selector

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed React key warning: heatmap fragment rows now use `<Fragment key={dow}>` instead of bare `<>`
- Fixed test failures: `@testing-library/jest-dom` not installed — replaced `toBeInTheDocument()` with `.toBeTruthy()` and `toHaveAttribute()` with `.getAttribute()` assertions; added explicit `afterEach(cleanup)` to prevent DOM accumulation between tests

### Completion Notes List

- Tasks 1–9 implemented and all tests passing (381/381)
- Task 10 left for manual verification by the user
- `parsePeriodParam` exported from `app/admin/analytics/page.tsx` for testability
- Native SVG bar chart (no new deps); HTML grid heatmap with static Tailwind opacity literal array
- `AnalyticsPeriodSelector` is the only Client Component; all chart components are Server Components
- `error` checked before `emptyState` in page render (both true on error path — Story 7.1 D4 contract)
- `loading.tsx` uses `grid-template-columns: repeat(25, ...)` inline style matching real heatmap grid

### File List

- `app/admin/analytics/page.tsx` — NEW
- `app/admin/analytics/loading.tsx` — NEW
- `components/admin/AnalyticsPeriodSelector.tsx` — NEW
- `components/admin/AnalyticsOrderVolumeChart.tsx` — NEW
- `components/admin/AnalyticsPeakHoursHeatmap.tsx` — NEW
- `components/admin/AnalyticsEmptyState.tsx` — NEW
- `components/admin/AnalyticsErrorPanel.tsx` — NEW
- `components/admin/AdminNav.tsx` — UPDATED (added BarChart3 import + Analytics tab entry)
- `lib/analytics/getRestaurantAnalytics.ts` — UPDATED (zero-fill missing days via `padDays`, D2 patch)
- `tests/unit/admin/analytics/parsePeriodParam.test.ts` — NEW
- `tests/unit/admin/analytics/AnalyticsPeriodSelector.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsOrderVolumeChart.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsPeakHoursHeatmap.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsEmptyState.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsErrorPanel.test.tsx` — NEW
- `tests/unit/admin/AdminNav.test.tsx` — NEW
- `tests/unit/lib/analytics/getRestaurantAnalytics.test.ts` — UPDATED (added zero-fill tests for D2)
- `tests/e2e/admin-analytics.spec.ts` — NEW

### Change Log

- 2026-05-20: Story 7.2 implemented — analytics page, loading skeleton, period selector, bar chart, heatmap, empty/error panels, AdminNav entry, unit tests (34 new), E2E smoke test
- 2026-05-20: Code review patches applied — 13 patches resolving 4 decisions (D1, D2 → patch; D3, D4 → confirmed intent). Key fixes: zero-fill missing days in `ordersByDay` (AC #1), bar-width clamp for 90d chart, full ARIA grid semantics on heatmap, hour labels `HH:00`, loading skeleton matches real layout, AdminNav tests strict per-surface count + desktop order. 8 new tests added (389/389 passing).

## Review Findings (2026-05-20)

_3 review layers ran on uncommitted+untracked diff (~1297 lines). 4 decisions resolved (D1, D2 → patches; D3, D4 → dismissed as confirmed intent). 13 patches queued. 2 items deferred (pre-existing or explicitly out-of-scope per spec). 9 dismissed as noise._

### Action Items

- [x] [Review][Patch] D1 — Delete dead `formatDateLabel` conditional [components/admin/AnalyticsOrderVolumeChart.tsx:13-18]
- [x] [Review][Patch] D2 — Zero-fill missing days in `getRestaurantAnalytics` helper so `ordersByDay` has one bar per day in period (AC #1) [lib/analytics/getRestaurantAnalytics.ts]
- [x] [Review][Patch] P1 — Clamp bar width to prevent negative values at 90d (90 bars × 4px gaps > 320px viewBox) [components/admin/AnalyticsOrderVolumeChart.tsx]
- [x] [Review][Patch] P2 — Loading skeleton `gridTemplateColumns` must match real heatmap (`3rem repeat(24, minmax(12px, 1fr))`) [app/admin/analytics/loading.tsx:23]
- [x] [Review][Patch] P3 — Add `role="grid"` + `role="row"` + `role="gridcell"` + column/row headers to heatmap; update tests to use `getByRole` [components/admin/AnalyticsPeakHoursHeatmap.tsx + test]
- [x] [Review][Patch] P4 — Add `type="button"` to period-selector buttons [components/admin/AnalyticsPeriodSelector.tsx]
- [x] [Review][Patch] P5 — Widen `searchParams.period` type to `string | string[] | undefined` and handle array case in `parsePeriodParam` [app/admin/analytics/page.tsx]
- [x] [Review][Patch] P6 — Use regex `/\/admin/` in `waitForURL` to match existing e2e patterns [tests/e2e/admin-analytics.spec.ts:36]
- [x] [Review][Patch] P7 — Hour labels in heatmap header should read `00:00`–`23:00` per AC #9 (currently `00`–`23`) [components/admin/AnalyticsPeakHoursHeatmap.tsx]
- [x] [Review][Patch] P8 — Loading skeleton missing `<h2>Order Volume</h2>` / `<h2>Peak Hours</h2>` placeholders + UTC footnote line [app/admin/analytics/loading.tsx]
- [x] [Review][Patch] P9 — AdminNav test should assert both surfaces render Analytics (`length === 2`) [tests/unit/admin/AdminNav.test.tsx]
- [x] [Review][Patch] P10 — AdminNav nav-order test should verify desktop sidebar order too (currently only mobile due to first-occurrence `indexOf`) [tests/unit/admin/AdminNav.test.tsx]
- [x] [Review][Patch] P11 — Add heatmap test for low-count opacity edge: `count=1, maxCount=10 → bg-accent/10` [tests/unit/admin/analytics/AnalyticsPeakHoursHeatmap.test.tsx]
- [x] [Review][Defer] Profile-fetch error redirects to `/auth/onboarding` instead of surfacing the DB error [app/admin/analytics/page.tsx] — deferred, pre-existing (same pattern as `app/admin/orders/page.tsx`)
- [x] [Review][Defer] Mobile bottom-bar may clip "Analytics" label at 360px width [components/admin/AdminNav.tsx] — deferred, story explicitly says do not redesign nav here

### Dismissed (9)

- Heatmap aria-label uses "1 order" (singular) vs spec literal "N orders" — plural-aware grammar is strictly better UX
- AnalyticsErrorPanel heading+body structure vs spec single em-dash sentence — better panel UI, spec describes content not markup
- UTC footnote only inside heatmap (not page-level) — spec explicitly permits "below the heatmap"
- `Math.max(...veryLargeArray)` spread fragility — bounded at 90/168 elements, never reaches engine arg limit
- RealtimeProvider mounts on analytics page — spec explicitly acknowledges this as "fine, just inert"
- `HEATMAP_OPACITY_CLASSES[0]` reserved but unused — works correctly; index 0 is documented as reserved
- D3: AC #4 empty-state body wording — user confirmed Task 6 "optional polish" copy is intended
- D4: Heatmap opacity uses `Math.round` not `Math.ceil` — user confirmed Dev Notes line 209 is the intended formula
- AC #5 ErrorPanel content split into heading + body — better panel structure; merged with above
