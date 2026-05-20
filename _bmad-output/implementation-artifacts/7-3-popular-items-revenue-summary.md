# Story 7.3: Popular Items & Revenue Summary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to know which items sell the most and what total revenue I've generated,
so that I can refine my menu and pricing decisions.

## Acceptance Criteria

1. **Given** the analytics page is rendered for the selected period and `data.emptyState === false`
   **When** the "Popular Items" section displays
   **Then** the top 10 items by order count are listed, ranked 1–10
   **And** each row shows: numeric rank, item name, order count (`quantity`), and total revenue formatted via `utils/formatPrice.ts`
   **And** items deleted from the menu after orders were placed still appear — `topItems[i].name` is read from the order-time denormalized `items` jsonb, never re-joined to `menu_items` (already enforced by Story 7.1's SQL function; do not introduce a join here)

2. **Given** a popular item has variant breakdowns (`Object.keys(variants).length > 1`, OR the single key is not `"standard"`)
   **When** the row is tapped
   **Then** the row expands inline below the row to show variant counts, formatted as `"<label>: <count>"` joined by `" / "` (e.g. `"without bacon: 12 / standard: 31"`)
   **And** variant labels are rendered in descending count order (most-ordered variant first), ties broken alphabetically
   **And** the expand button uses `aria-expanded` + `aria-controls` linked to the panel id (matches `components/admin/OrderCard.tsx` pattern)
   **And** items whose variants object has only `{ "standard": N }` are non-interactive (no chevron, no tap handler) — there is no breakdown to show

3. **Given** the period selector value
   **When** the "Revenue Summary" tile renders above the charts
   **Then** it shows three KPIs: total revenue (`data.totalRevenueCents`), average order value (`data.averageOrderValueCents`), and order count (`data.orderCount`)
   **And** all currency values are formatted via `utils/formatPrice.ts` — no inline `$${n / 100}` strings
   **And** all data comes from the same `getRestaurantAnalytics` call as Story 7.2 — **one** round-trip per page render; do NOT add a second helper call

4. **Given** revenue calculations
   **When** the helper aggregates totals
   **Then** all amounts remain integer `price_cents` (`bigint` in SQL, `number` in TS) — never converted to float at any layer
   **And** `averageOrderValueCents = Math.round(totalRevenueCents / orderCount)` when `orderCount > 0`, else `0` (already enforced by Story 7.1 helper; do not re-implement)
   **And** display formatting always goes through `utils/formatPrice.ts` — no inline currency rendering anywhere

5. **Given** `data.emptyState === false` AND `data.topItems.length === 0` (defensive — should not occur, but handle gracefully)
   **When** the Popular Items section renders
   **Then** it shows an inline empty-state panel "No items sold yet in this period" (small, quiet — matches `AnalyticsEmptyState` aesthetic but lives inside the section, not the whole page)
   **And** the Revenue Summary tile still renders with `$0.00 / 0 / 0 orders` — never `NaN`, never division-by-zero artifacts

6. **Given** `data.emptyState === true` (orderCount < 30) OR `data.error === true`
   **When** the page renders
   **Then** the existing page-level branching from Story 7.2 wins: the whole body shows `<AnalyticsEmptyState />` or `<AnalyticsErrorPanel />` respectively — Revenue Summary and Popular Items are NOT rendered
   **And** the page-level branch order remains `error → emptyState → content` (do not change it)

7. **Given** the route-level `loading.tsx` skeleton
   **When** a period change is in flight
   **Then** the skeleton matches the new page layout exactly: Revenue Summary tile placeholder, then existing chart placeholders, then a Popular Items list placeholder (10 row placeholders) — no spinners (UX-DR12)

---

## Tasks / Subtasks

- [x] **Task 1 — `AnalyticsRevenueSummary` component** (AC: #3, #4, #5)
  - [x] Create `components/admin/AnalyticsRevenueSummary.tsx` — Server Component (no `'use client'`; pure presentation)
  - [x] Props: `{ totalRevenueCents: number; averageOrderValueCents: number; orderCount: number }`
  - [x] Layout: a tile row with three KPI cells; on mobile stack vertically with `flex flex-col gap-3 sm:flex-row sm:gap-6`. Each cell: small uppercase label (`text-xs text-text-secondary uppercase tracking-wide`) + large value (`text-2xl font-semibold text-text-primary`).
  - [x] Labels: "Total Revenue", "Average Order", "Orders"
  - [x] Values: `formatPrice(totalRevenueCents)`, `formatPrice(averageOrderValueCents)`, `orderCount.toLocaleString()` (toLocaleString is fine; thousand separators help readability and 3-digit cap is unlikely)
  - [x] Container: `rounded-lg border border-border bg-surface-raised px-4 py-5` — matches the panel aesthetic of `AnalyticsEmptyState`
  - [x] No new icons; the labels are self-explanatory (UX rule: quiet, encouraging — not decorative)
  - [x] aria: outer container `role="group" aria-label="Revenue summary"`; each KPI value has `aria-label="<label>: <value>"` for screen readers
  - [x] **MUST** route every currency through `@/utils/formatPrice` — no inline `$${n / 100}` allowed (project-context anti-pattern)

- [x] **Task 2 — `AnalyticsPopularItemRow` (Client Component, single expandable row)** (AC: #1, #2, #5)
  - [x] Create `components/admin/AnalyticsPopularItemRow.tsx` — starts with `'use client'` (needs `useState` for expansion)
  - [x] Props: `{ rank: number; item: TopItem }`
  - [x] Compute `hasBreakdown`: `Object.keys(item.variants).length > 1` OR (length === 1 AND the only key is NOT `'standard'`)
  - [x] Compute `variantEntries`: `Object.entries(item.variants).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))` — count desc, name asc tiebreaker
  - [x] Row layout:
    - When `hasBreakdown=false`: render a non-interactive `<div>` (not a button) with the same row layout — no chevron, no `aria-expanded`
    - When `hasBreakdown=true`: render a `<button type="button" aria-expanded={isExpanded} aria-controls={panelId} onClick={() => setIsExpanded(v => !v)}>` — pattern lifted from `OrderCard.tsx:37-44`
  - [x] Row content (left-to-right, single row, `flex items-center gap-3 px-4 py-3`):
    - Rank chip: `<span className="w-6 text-sm font-semibold text-text-secondary tabular-nums">{rank}</span>` (right-aligned numeric)
    - Item name (truncate if needed): `<span className="flex-1 truncate text-sm font-medium text-text-primary">{item.name}</span>`
    - Quantity: `<span className="shrink-0 text-sm text-text-secondary tabular-nums">{item.quantity}</span>`
    - Revenue: `<span className="shrink-0 text-sm text-text-secondary tabular-nums">{formatPrice(item.revenueCents)}</span>`
    - Chevron icon (only when `hasBreakdown`): use `lucide-react` `ChevronDown` icon, rotated 180° via `className="transition-transform aria-expanded:rotate-180"` OR conditional class — match `OrderCard` (no chevron there; analogue is the expand UX in `MenuItemList.tsx`). If `lucide-react` `ChevronDown` is not yet imported anywhere in admin, just verify it's exported (`lucide-react` is an existing dep — no install)
  - [x] Expanded panel:
    - Render `<div id={panelId} className="px-4 pb-3 pl-13 text-xs text-text-secondary">{variantBreakdownString}</div>` (the `pl-13` indents under the name column)
    - `variantBreakdownString = variantEntries.map(([label, n]) => `${label}: ${n}`).join(' / ')`
    - The panel only renders when `isExpanded` is true (mirrors `OrderCard.tsx:65-78`)
  - [x] Use `useId()` for `panelId` (matches `OrderCard.tsx:22`); never hand-roll an id from `rank` or `item.name`
  - [x] Bottom border on each row: `border-b border-border` (last row drops the border via `last:border-b-0`)

- [x] **Task 3 — `AnalyticsPopularItems` section wrapper** (AC: #1, #5)
  - [x] Create `components/admin/AnalyticsPopularItems.tsx` — Server Component (no `'use client'`)
  - [x] Props: `{ items: TopItem[] }`
  - [x] Render `<section>` with `<h2 className="mb-3 text-sm font-semibold text-text-primary">Popular Items</h2>` (matches the chart `<h2>` styling in `AnalyticsOrderVolumeChart.tsx:45`)
  - [x] Slice `items.slice(0, 10)` — Story 7.1 already returns up to 50 items sorted by quantity DESC, name ASC, so slicing is sufficient (do NOT re-sort)
  - [x] Defensive empty-state (AC #5): when `items.length === 0`, render an inline panel:
    ```
    <div className="rounded-lg border border-border py-8 text-center">
      <p className="text-sm text-text-secondary">No items sold yet in this period</p>
    </div>
    ```
  - [x] Otherwise render `<ul className="rounded-lg border border-border bg-surface-raised">` with one `<li>` per item: `<li key={`${item.name}-${rank}`}><AnalyticsPopularItemRow rank={rank} item={item} /></li>`
  - [x] **Key strategy**: use `${item.name}-${rank}` because `name` alone is not guaranteed unique across historical orders with the same name (edge: same name appears twice in topItems — should not happen given the SQL `GROUP BY nm`, but `rank` makes it safe even if it does)
  - [x] aria: outer wrapper `role="region" aria-label="Top 10 popular items"`; the `<ul>` itself has `role="list"` (redundant for screen readers, but explicit)

- [x] **Task 4 — Wire Revenue Summary and Popular Items into the analytics page** (AC: #3, #6)
  - [x] Edit `app/admin/analytics/page.tsx`:
    - Add imports: `import { AnalyticsRevenueSummary } from '@/components/admin/AnalyticsRevenueSummary'` and `import { AnalyticsPopularItems } from '@/components/admin/AnalyticsPopularItems'`
    - Inside the existing `data.emptyState` / `data.error` branching (lines 47–67), update the "else" branch (the fragment that currently renders chart + heatmap) to:
      1. `<AnalyticsRevenueSummary totalRevenueCents={data.totalRevenueCents} averageOrderValueCents={data.averageOrderValueCents} orderCount={data.orderCount} />`
      2. `<div className="mt-6"><AnalyticsOrderVolumeChart data={data.ordersByDay} /></div>`
      3. `<div className="mt-8"><AnalyticsPeakHoursHeatmap data={data.ordersByDowHour} /></div>`
      4. `<div className="mt-8"><AnalyticsPopularItems items={data.topItems} /></div>`
  - [x] **PRESERVE** the existing `data.error → AnalyticsErrorPanel` and `data.emptyState → AnalyticsEmptyState` branches and their order (`error` checked before `emptyState` — both can be true simultaneously per Story 7.1 D13 contract)
  - [x] No change to `getRestaurantAnalytics` call — the helper already returns `topItems`, `totalRevenueCents`, `averageOrderValueCents`, `orderCount` from the same single RPC

- [x] **Task 5 — Update route-level `loading.tsx` skeleton** (AC: #7)
  - [x] Edit `app/admin/analytics/loading.tsx`:
    - Insert a Revenue Summary skeleton BETWEEN the period-selector chips (lines 9–16) and the Order Volume placeholder (lines 19–22):
      ```
      <div className="mt-6 rounded-lg border border-border bg-surface-raised px-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-20 animate-pulse rounded bg-surface-overlay" />
              <div className="h-7 w-24 animate-pulse rounded bg-surface-overlay" />
            </div>
          ))}
        </div>
      </div>
      ```
    - Append a Popular Items skeleton AFTER the heatmap block (after line 40, before the closing `</div>`):
      ```
      <div className="mt-8">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-overlay" />
        <div className="rounded-lg border border-border bg-surface-raised">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="h-4 w-6 animate-pulse rounded bg-surface-overlay" />
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-overlay" />
              <div className="h-4 w-10 animate-pulse rounded bg-surface-overlay" />
              <div className="h-4 w-16 animate-pulse rounded bg-surface-overlay" />
            </div>
          ))}
        </div>
      </div>
      ```
  - [x] Skeleton heights and widths MUST be roughly equal to the rendered sections — UX-DR12 says no layout shift between skeleton and content
  - [x] No spinners; no new icons

- [x] **Task 6 — Unit tests** (AC: #1, #2, #3, #4, #5)
  - [x] `tests/unit/admin/analytics/AnalyticsRevenueSummary.test.tsx`:
    - Renders all three labels ("Total Revenue", "Average Order", "Orders")
    - `formatPrice(150000)` → "$1500.00" renders as expected (use exact `formatPrice` output, not a regex on `$`)
    - `orderCount=0, totalRevenueCents=0, averageOrderValueCents=0` renders "$0.00 / $0.00 / 0" without NaN
    - `orderCount=1500` renders with thousand separator (`"1,500"`)
  - [x] `tests/unit/admin/analytics/AnalyticsPopularItems.test.tsx`:
    - Renders at most 10 rows when given 50 items (slice behavior)
    - Renders the defensive "No items sold yet in this period" panel when items=[]
    - Each rendered row has rank text equal to its array index + 1
    - aria region label "Top 10 popular items" present
  - [x] `tests/unit/admin/analytics/AnalyticsPopularItemRow.test.tsx`:
    - Renders name, quantity, formatted revenue
    - When `variants = { standard: 5 }` (single key === "standard"): no chevron, no `aria-expanded` attribute (row is a div, not a button)
    - When `variants = { "standard": 31, "without bacon": 12 }`: chevron present, `aria-expanded="false"` initially, clicking toggles to `aria-expanded="true"` and reveals the breakdown text
    - Breakdown string format: count desc, name asc tiebreaker — `"standard: 31 / without bacon: 12"`
    - Breakdown for `{ "a": 5, "b": 5 }` (tie): `"a: 5 / b: 5"` (alphabetical tiebreaker)
    - Re-uses `OrderCard.test.tsx` assertion style: `getAttribute('aria-expanded')`, not `toHaveAttribute()` (per Story 7.2 dev-record: `@testing-library/jest-dom` is NOT installed — use plain `.getAttribute()` / `.toBeTruthy()`)
    - Test setup must include `afterEach(cleanup)` from `@testing-library/react` (per Story 7.2 debug-log: tests accumulate DOM without it)
  - [x] No update needed for existing `parsePeriodParam.test.ts`, `AnalyticsPeriodSelector.test.tsx`, `AnalyticsOrderVolumeChart.test.tsx`, `AnalyticsPeakHoursHeatmap.test.tsx`, `AnalyticsEmptyState.test.tsx`, `AnalyticsErrorPanel.test.tsx` — they cover unchanged components

- [x] **Task 7 — Extend E2E smoke test** (AC: #3, #1)
  - [x] Edit `tests/e2e/admin-analytics.spec.ts`:
    - Add assertions in the existing "page loads" test (or a new test in the same file) that the page contains the text "Total Revenue", "Average Order", and "Orders" KPI labels OR shows the empty-state panel — exactly mirrors the pattern already used (`expect either empty-state OR charts to render`)
    - Add assertion: if topItems renders (i.e. non-empty case), the heading "Popular Items" appears
  - [x] Do NOT add a new spec file — extend the existing one. Story 7.2 created `admin-analytics.spec.ts`; keep the analytics surface in one spec
  - [x] No assertion on pixel layout or exact counts — E2E confirms the page composes; unit tests cover content

- [ ] **Task 8 — Verification: manual visual check + accessibility audit**
  - [ ] Start the dev server (`npm run dev`), sign in as a test owner with ≥30 seeded orders that include variant-bearing items, visit `/admin/analytics`
  - [ ] Verify Revenue Summary tile renders with three KPIs, mobile-stacked at 360px width, side-by-side at ≥640px
  - [ ] Verify Popular Items list shows up to 10 rows, ranked correctly; tap a row with variants → expansion shows breakdown in count-desc order; tap again → collapses
  - [ ] Verify a row with no variants (or only `{ standard: N }`) is non-interactive — no chevron, no aria-expanded
  - [ ] Tab through the page — confirm Popular Items rows with `hasBreakdown` are keyboard-focusable (they're `<button>`), and non-interactive rows are skipped via natural tab order
  - [ ] Test all four period values produce a non-broken render (today often empty → page-level emptyState wins → Revenue/Popular sections do NOT render → correct per AC #6)
  - [ ] Confirm `formatPrice` output appears nowhere as `NaN`, `Infinity`, or `$undefined`
  - [ ] (Left for manual verification by user)

---

## Dev Notes

### Critical Context

**Single round-trip — the helper already returns everything.** Story 7.1's `getRestaurantAnalytics` returns `totalRevenueCents`, `averageOrderValueCents`, `orderCount`, and `topItems[]` in the same `AnalyticsData` payload that 7.2 already destructures. This story consumes existing fields — **DO NOT** add a second RPC call, a second helper, or any new SQL. The page passes the same `data` object to the new components.

**`topItems` is already sorted and capped at 50.** The SQL function (see `supabase/migrations/20260520150000_patch_get_restaurant_analytics_function.sql:78-88`) does `ORDER BY SUM(vqty) DESC, nm ASC LIMIT 50`. This story slices the first 10 — there is no need to re-sort in TS. Re-sorting on the client would be a regression risk if the SQL tiebreaker semantics change.

**`variants` jsonb shape — "standard" is the no-variants sentinel.** The SQL function (see `migrations/...:55-62`) labels items with empty/null `variants` arrays as `"standard"`. So an item with no real variants will have `variants = { "standard": N }`. Rule for this story: if the only key is `"standard"`, the row has no meaningful breakdown → render as non-interactive (no chevron, no expansion, no `aria-expanded`). If multiple keys (including `"standard"` mixed with others) exist, render all of them in count-desc order.

**Empty-state branching belongs at the page level, not the component level.** Story 7.2's page already routes `error → AnalyticsErrorPanel`, `emptyState → AnalyticsEmptyState`, else → content. This story adds Revenue Summary + Popular Items to the "else" branch — they NEVER render when `emptyState=true` or `error=true`. The Popular Items component's *own* `items.length === 0` panel (AC #5) is **defensive only** — it covers the impossible-but-not-crashing path where `emptyState=false` yet `topItems=[]`. Do not try to consolidate these two empty-states.

**Items deleted from the menu still appear correctly — automatic.** Story 7.1's design denormalizes `item.name` into the `orders.items` jsonb at submission time, so the SQL function aggregates from there with no `menu_items` join. The same item-name string survives a menu deletion. This story requires NO code to handle that — just **don't add a join** to `menu_items` in any new helper. If you find yourself reaching for `menu_items` here, you're going down the wrong path.

**Revenue arithmetic stays integer all the way.** `revenueCents` is `bigint` in SQL and `number` (integer) in TS via `Math.round(...)`. Story 7.1's helper already enforces this for `averageOrderValueCents`. The only place currency becomes a float-shaped string is at the very end, inside `utils/formatPrice.ts` (`priceCents / 100`). Anywhere else dividing by 100 is an anti-pattern.

**The page is still a Server Component.** Only `AnalyticsPopularItemRow` adds `'use client'` (needs `useState` for expansion). `AnalyticsRevenueSummary` and `AnalyticsPopularItems` are Server Components. This matches the 7.2 pattern: charts/empty/error are server, the period selector is the only client component.

**Reuse the `OrderCard.tsx:21-78` expansion pattern verbatim.** Same `useId()` for `panelId`, same `aria-expanded` + `aria-controls`, same conditional render of the expanded panel. The dev agent should literally read `OrderCard.tsx` before writing the row — copying its accessibility wiring eliminates bugs.

**No `@testing-library/jest-dom`.** Story 7.2's dev record (line 385) records that `toBeInTheDocument()` and `toHaveAttribute()` do not work in this repo. Use `.toBeTruthy()` and `.getAttribute()` instead. Also wire `afterEach(cleanup)` from `@testing-library/react` at the top of every test file — without it, DOM nodes accumulate across tests and assertions like `getAllByRole(...)` return polluted results.

### Architecture Compliance

**Routing:** No new routes. Story 7.2's `/admin/analytics` is the only route; this story extends its body. The admin layout (`app/admin/layout.tsx`) already gates auth and `profile.restaurant_id`.

**Client selection** (see `docs/conventions/supabase-clients.md`):
- Page continues to use the **server cookie client** — owner identity from JWT, RLS-protected.
- `getRestaurantAnalytics` already accepts any client; this story passes the same cookie client the page already builds. **Do not** import `createAdminClient` here.

**Server Action discipline** doesn't apply — this story has no Server Actions. All reads via the existing helper. The period change is URL navigation (Story 7.2's `AnalyticsPeriodSelector` writes `?period=…`).

**Naming compliance:**
- Components: PascalCase — `AnalyticsRevenueSummary`, `AnalyticsPopularItems`, `AnalyticsPopularItemRow`
- Files: PascalCase `.tsx`
- Test files: `tests/unit/admin/analytics/<ComponentName>.test.tsx` (matches the directory created by 7.2)
- All variables: camelCase; never snake_case on the TS side (the snake_case → camelCase remap already happened in `getRestaurantAnalytics`)

**Price discipline:**
- All revenue/currency values are `priceCents` integers everywhere except the final `formatPrice()` call.
- `utils/formatPrice.ts` is the ONLY currency formatter. Do not write `$${n/100}` or use `Intl.NumberFormat` or any `toFixed(2)` outside that file.
- `orderCount.toLocaleString()` (no args) is acceptable for thousand separators — it's an integer count, not currency.

**Styling rules:**
- Tailwind only — no CSS-in-JS, no inline `style=` for layout.
- Design tokens only: `bg-surface-raised`, `bg-surface-overlay`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-accent`. All exist in `tailwind.config.ts`.
- Breakpoints: `sm` only (no `md`, per UX spec already followed by 7.2).
- `tabular-nums` on numeric columns so ranks/counts/prices vertically align across rows.

**Anti-patterns to avoid:**
- Do **not** add a new helper for Popular Items or Revenue Summary — they are slices of the existing `AnalyticsData` object.
- Do **not** re-query Supabase for popular items — Story 7.1's RPC already returned them.
- Do **not** join `menu_items` for item names — the denormalized name in `orders.items` IS the source of truth (deleted items must still appear).
- Do **not** inline `$` formatting; always `formatPrice(cents)`.
- Do **not** add a chart library to "make Popular Items more visual" — bars/sparklines are out of scope and would re-open the no-new-deps decision deferred in 7.2.
- Do **not** introduce a Zustand store for the expanded-row state — local `useState` per row is correct (multiple rows can be expanded simultaneously; no global state needed).
- Do **not** key the popular-item rows by `item.name` alone — name collisions are theoretically possible across historical denormalized items; use `${item.name}-${rank}`.
- Do **not** `JSON.parse` `topItems[].variants` — it is already a plain object on the TS side (the helper's `r.variants ?? {}` line in `getRestaurantAnalytics.ts:170`).
- Do **not** use `Object.entries(variants).map(...).join(', ')` (wrong separator) — the AC specifies `' / '` (slash with spaces).
- Do **not** render Revenue Summary or Popular Items inside the `data.emptyState` or `data.error` branch — AC #6 explicitly forbids it.
- Do **not** add `Sentry.captureException` here — the helper already logs via `console.error`, picked up by the instrumentation hook.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`app/admin/analytics/page.tsx`** — the file Task 4 modifies:
- Current state: Server Component; auth/profile gate; calls `getRestaurantAnalytics`; branches on `data.error` → `data.emptyState` → renders `<AnalyticsOrderVolumeChart>` + `<AnalyticsPeakHoursHeatmap>` in a fragment.
- What this story changes: the "else" content branch gains a Revenue Summary tile (above the chart) and a Popular Items section (below the heatmap). The branch order and gate logic stay identical.
- What must be preserved: the `parsePeriodParam` helper export (used by tests), the `searchParams: Promise<{ period?: string | string[] }>` type, the `await searchParams` destructure, the `redirect('/auth/login')` / `redirect('/auth/onboarding')` calls.

**`app/admin/analytics/loading.tsx`** — the file Task 5 modifies:
- Current state: skeleton matching exactly the period-selector + chart + heatmap layout (heatmap uses `gridTemplateColumns: '3rem repeat(24, minmax(12px, 1fr))'`).
- What this story changes: insert Revenue Summary skeleton between selector and chart; append Popular Items skeleton after heatmap; keep UTC footnote placeholder.
- What must be preserved: the existing heatmap skeleton's `gridTemplateColumns` style (it matches the real heatmap exactly per Story 7.2 P2 patch).

**`components/admin/OrderCard.tsx:21-78`** — the canonical expandable-row pattern this story copies:
- `useState` for `isExpanded`; `useId()` for `panelId`; `<button>` with `aria-expanded` + `aria-controls`; conditional `<div id={panelId}>` for the expanded content.
- What you copy: the accessibility wiring, the conditional render, the `useId` usage.
- What you change: the row content (rank + name + qty + revenue + chevron); the expansion body (variant string instead of item list).

**`components/admin/AnalyticsEmptyState.tsx`** — the panel aesthetic to match for the defensive empty state in `AnalyticsPopularItems` (AC #5):
- `flex flex-col items-center justify-center rounded-lg border border-border py-16 text-center`
- For the Popular Items inline empty state, reduce vertical padding to `py-8` (the surrounding section already provides spacing).

**`components/admin/AnalyticsOrderVolumeChart.tsx:45`** — the `<h2 className="mb-3 text-sm font-semibold text-text-primary">Order Volume</h2>` heading pattern to mirror for "Popular Items".

**`components/admin/AnalyticsPeakHoursHeatmap.tsx`** — referenced for ARIA pattern (`role="region"`, `aria-label`); not modified.

**`lib/analytics/getRestaurantAnalytics.ts:164-171`** — the `topItems` build path:
- Snake_case → camelCase rename happens here (`revenue_cents` → `revenueCents`, `quantity` and `name` unchanged).
- `variants` field comes through as plain object (no JSON parse needed).
- When `emptyState=true`, the array is **suppressed** (set to `[]`) — page-level branching is what prevents popular-items rendering in that case.

**`types/app.ts:138-156`** — type contracts:
- `TopItem = { name: string; quantity: number; revenueCents: number; variants: Record<string, number> }`
- `AnalyticsData.totalRevenueCents`, `averageOrderValueCents`, `orderCount`, `topItems` — all already populated by the helper. No type changes needed.
- The `error?: boolean` flag is optional on `AnalyticsData` — page-level check is `if (data.error)` (Story 7.2 line 55).

**`utils/formatPrice.ts`** — two lines; the ONLY currency formatter:
```ts
export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`
}
```
Output format is fixed: `$1500.00`, `$0.00`, `$-50.00` (negative possible but irrelevant for revenue). No locale-aware grouping. Tests should assert exact strings.

**`tests/unit/admin/OrderCard.test.tsx`** — closest test-pattern analogue for the expandable row:
- `afterEach(cleanup)` import at top.
- Assertions use `.getAttribute()` and `.toBeTruthy()`.
- Click via `fireEvent.click(button)` then re-query.

**`tests/unit/admin/analytics/AnalyticsEmptyState.test.tsx`** — reference for a minimal Vitest component test.

**`tests/e2e/admin-analytics.spec.ts`** — file Task 7 extends:
- Existing pattern: login as test owner via shared helpers in `tests/rls/helpers.ts`, navigate, assert "page renders SOMETHING, not crash".
- Add assertions in the same style — no pixel-level checks.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `components/admin/AnalyticsRevenueSummary.tsx` | NEW | Server Component; three-KPI tile |
| `components/admin/AnalyticsPopularItems.tsx` | NEW | Server Component; section wrapper, slices top 10, renders defensive empty-state |
| `components/admin/AnalyticsPopularItemRow.tsx` | NEW | Client Component; one row with optional expansion |
| `app/admin/analytics/page.tsx` | UPDATE | Render Revenue Summary above charts, Popular Items below heatmap (only in else-branch) |
| `app/admin/analytics/loading.tsx` | UPDATE | Add Revenue Summary + Popular Items skeleton blocks |
| `tests/unit/admin/analytics/AnalyticsRevenueSummary.test.tsx` | NEW | Labels, values, NaN/0 cases, locale grouping |
| `tests/unit/admin/analytics/AnalyticsPopularItems.test.tsx` | NEW | Top-10 slice, defensive empty-state, ranks, aria region |
| `tests/unit/admin/analytics/AnalyticsPopularItemRow.test.tsx` | NEW | Standard-only non-interactive, expansion toggle, variant order |
| `tests/e2e/admin-analytics.spec.ts` | UPDATE | Add Revenue Summary + Popular Items label assertions |

**No changes to:**
- `lib/analytics/getRestaurantAnalytics.ts` — already returns all needed fields
- `types/app.ts` — `TopItem`, `AnalyticsData` already defined
- Any SQL migration — Story 7.1 already produced the `top_items` LIMIT 50 path
- `components/admin/AdminNav.tsx` — Analytics entry exists (Story 7.2)
- `components/admin/AnalyticsPeriodSelector.tsx` — URL writer unchanged
- `components/admin/AnalyticsOrderVolumeChart.tsx`, `AnalyticsPeakHoursHeatmap.tsx`, `AnalyticsEmptyState.tsx`, `AnalyticsErrorPanel.tsx` — unchanged

### Testing Standards

**Three test layers — three runners (project-context rule):**

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/analytics/` | Vitest (`npm run test`) | Components: Revenue Summary, Popular Items, Popular Item Row |
| RLS integration | n/a | — | **Not used** — no new DB access patterns; 7.1's `tests/rls/analytics.spec.ts` covers tenant isolation for `topItems` |
| E2E | `tests/e2e/admin-analytics.spec.ts` | Playwright (`npm run test:e2e`) | Extend existing spec; assert new sections render |

**Vitest harness reminders (from Story 7.2 debug-log):**
- `@testing-library/jest-dom` is NOT installed — use `.toBeTruthy()`, `.getAttribute()`, `.textContent.includes(...)` instead of `toBeInTheDocument()` / `toHaveAttribute()`.
- Add `import { afterEach } from 'vitest'` and `import { cleanup } from '@testing-library/react'` then `afterEach(cleanup)` to every component test file — without it, multiple `render()` calls in one file leak DOM and `getAllByRole('listitem')` returns multiplied results.

**Mock discipline:**
- Component tests pass synthetic `TopItem[]` arrays directly — no Supabase mocking needed.
- `useId` is deterministic enough in Vitest for `aria-controls` testing — don't mock it; just query by role/text.
- The page itself is a Server Component with `await` — page-level Vitest tests are NOT recommended (Story 7.2 also doesn't have one); E2E covers the integration.

**E2E rule:**
- Do **not** mock Supabase in E2E — must hit local Supabase per project-context "real-DB smoke test required" rule.
- Seed orders (if needed for non-empty rendering) via the same `tests/rls/helpers.ts` pattern used by `tests/rls/analytics.spec.ts`.

### Previous Story Intelligence

**From Story 7.2 (Order Volume & Peak Hours):**
- Page-level branching order is `error → emptyState → content`. Story 7.1's `error?: boolean` flag exists precisely so the page can distinguish RPC outage from "no orders yet". This story preserves that order and adds to the content branch.
- All chart-region components are Server Components by default; only the period selector is `'use client'`. This story follows the same split — only the expandable row is client.
- The `parsePeriodParam` helper is exported from `app/admin/analytics/page.tsx` for testability. Do not move it.
- Code-review patches P9/P10 (2026-05-20) added strict assertions to `AdminNav.test.tsx` (per-surface count, desktop sidebar order). The AdminNav is not modified in 7.3, so no test update is needed there.
- Code-review patch P3 (2026-05-20) added full ARIA grid semantics to the heatmap. The Popular Items list uses `role="region"` + `<ul>` + `<li>` instead — natural list semantics are clearer than grid for ranked rows.

**From Story 7.1 (Analytics Data Aggregation Layer):**
- `AnalyticsData.error?: boolean` flag was added in patch P13 — the helper sets it on RPC error and invalid-UUID paths. Page-level check is `if (data.error)`, before `emptyState`. Do not invert.
- camelCase nested fields: `topItems[i].revenueCents` (NOT `revenue_cents`). The helper remaps snake_case keys → camelCase.
- `top_items` is `LIMIT 50` in SQL (patch P12) so the caller can sort/slice by either axis without losing data. This story sorts by `quantity` (already the SQL's primary sort), slices 10.
- Aggregate arrays are EMPTY when `emptyState=true` (patch P10). Page-level branching prevents this story's components from rendering in that case. Defensive empty-state in `AnalyticsPopularItems` only fires when somehow `emptyState=false` but `topItems=[]` (impossible by 7.1's contract — defensive only).
- UTC pinning: SQL uses `AT TIME ZONE 'UTC'` for time aggregates. Items are time-agnostic — no UTC concerns for Popular Items / Revenue Summary.

### Latest Tech Information

- **`utils/formatPrice.ts` returns `$${(priceCents / 100).toFixed(2)}`** — for `priceCents = 150000` (i.e. $1,500.00), the output is the string `"$1500.00"` (no thousand separator). This is intentional and matches every other place in the codebase. Tests should assert the exact `"$1500.00"` string. If the AC implies thousand separators in revenue values, that is a `formatPrice` enhancement story — out of scope here.
- **`Intl.NumberFormat` is allowed for non-currency counts only** — `orderCount.toLocaleString()` produces locale-aware thousand grouping (e.g. `"1,500"`). Per Story 7.2 dev-notes, `Intl.DateTimeFormat` is the preferred date formatter; no `moment.js` / `date-fns` (not installed). Same principle applies to counts.
- **`lucide-react` is the icon library** — `ChevronDown` is exported. No new dep. `import { ChevronDown } from 'lucide-react'`.
- **Tailwind `aria-expanded:` variant** is available in Tailwind 3.4+ for conditional class application based on `aria-expanded` attribute. The chevron rotation can use either this variant or a conditional `className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}` — both are acceptable; the conditional class is more explicit.
- **Next.js 15 / React 19** — `useId()` is the React 19 stable hook; `useState` works as expected; no Suspense quirks for this story. The page remains a Server Component; only the row is `'use client'`.
- **Cloudflare Workers compatibility** — none of these components depend on Node native APIs. `useId`, `useState`, native `<button>`/`<div>` all work in the edge runtime. No verification needed.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **`formatPrice.ts` is the only currency formatter** — every cents → display path goes through it. Inline formatting is an anti-pattern.
- **Price storage / arithmetic stays integer** — revenue is `bigint` in SQL, `number` (integer) in TS. Never `.toFixed`, never divide by 100 outside `formatPrice`.
- **Server Components by default** — only `AnalyticsPopularItemRow` adds `'use client'` (needs `useState`). `AnalyticsRevenueSummary` and `AnalyticsPopularItems` stay server-side.
- **Tailwind only, design tokens only** — no inline hex, no CSS-in-JS, no custom CSS files. Use `accent`, `surface-raised`, `surface-overlay`, `text-primary`, `text-secondary`, `border` tokens.
- **Path alias `@/*`** — `@/components/admin/AnalyticsRevenueSummary`, `@/types/app`, `@/utils/formatPrice`; never `../`.
- **`searchParams` in Next.js 15 is a Promise** — already handled by 7.2; this story doesn't touch the page's `searchParams` plumbing.
- **No spinners (UX-DR12)** — loading state is a skeleton matching the final layout. Task 5 updates `loading.tsx`.
- **No new dependencies without asking** — `lucide-react` and `@testing-library/react` are existing deps; do not add anything else.
- **Comments default to none** — only add a comment when the WHY is non-obvious (e.g. why "standard" key triggers non-interactive row; why slice 10 from a list of 50).

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — sparse on Phase 2 analytics UI; design decisions live in this story and Story 7.2
- Epics: `_bmad-output/planning-artifacts/epics.md` lines 1049–1079 — source ACs for Story 7.3
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR45–FR48 (Post-MVP analytics)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR12 (no spinners; skeletons match layout); no explicit analytics screen spec — design choices live in this story
- Project Context: `_bmad-output/project-context.md` — Technology Stack, Server-Component-first rule, Tailwind discipline, formatPrice mandate, "Ask First" for new deps
- Prior art: `_bmad-output/implementation-artifacts/7-1-analytics-data-aggregation-layer.md` — the `AnalyticsData`/`TopItem` contract this story consumes (camelCase remap, suppressed-when-empty arrays, `error?: boolean` flag)
- Prior art: `_bmad-output/implementation-artifacts/7-2-order-volume-peak-hours-visualization.md` — the page-level branching order and skeleton aesthetic this story preserves; Vitest harness gotchas (`afterEach(cleanup)`, no `jest-dom`)
- Prior art: `components/admin/OrderCard.tsx` — canonical expandable-row pattern (lines 21–78)
- Prior art: `app/admin/analytics/page.tsx` — the page this story extends
- Prior art: `components/admin/AnalyticsEmptyState.tsx` — panel aesthetic for the defensive Popular Items empty state
- Prior art: `lib/analytics/getRestaurantAnalytics.ts:164-171` — `topItems` construction; confirms `variants` is plain object, names denormalized
- Prior art: `supabase/migrations/20260520150000_patch_get_restaurant_analytics_function.sql:78-88` — SQL `top_items LIMIT 50 ORDER BY quantity DESC, name ASC`; confirms slicing 10 in TS is safe
- Prior art: `utils/formatPrice.ts` — the only currency formatter; exact output `"$<n>.<nn>"` (no grouping)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `AnalyticsPopularItemRow.test.tsx` — initial aria-controls test used `CSS.escape(panelId)` which is not available in jsdom; replaced with `[id="${panelId}"]` attribute selector.

### Completion Notes List

- Tasks 1–7 implemented; all 416 tests passing (389 pre-existing + 27 new). Task 8 left for manual verification by user.
- `AnalyticsRevenueSummary`: Server Component, three-KPI tile with `formatPrice` for currency, `toLocaleString()` for order count; `role="group"` + per-value `aria-label`.
- `AnalyticsPopularItemRow`: Client Component; `useState` + `useId()` for expand/collapse mirroring `OrderCard.tsx`; `hasBreakdown` gate prevents non-interactive rows from getting button/chevron; variant breakdown sorted count-desc with alphabetical tiebreaker; separator is ` / `.
- `AnalyticsPopularItems`: Server Component; slices top 10 from the SQL-sorted `topItems` (no re-sort); defensive `items.length === 0` empty-state panel.
- `app/admin/analytics/page.tsx`: Revenue Summary rendered above charts, Popular Items below heatmap, both only in the `emptyState=false, error=false` branch; page-level error→emptyState→content order preserved.
- `app/admin/analytics/loading.tsx`: Revenue Summary skeleton (3 KPI label+value placeholders) added between period-selector and chart; Popular Items skeleton (10 row placeholders) added after heatmap.
- `tests/e2e/admin-analytics.spec.ts`: Two new tests added (Revenue Summary labels / Popular Items heading) using the same "render something OR empty-state OR error" pattern from 7.2.

### File List

- `components/admin/AnalyticsRevenueSummary.tsx` — NEW
- `components/admin/AnalyticsPopularItems.tsx` — NEW
- `components/admin/AnalyticsPopularItemRow.tsx` — NEW
- `app/admin/analytics/page.tsx` — UPDATED (added Revenue Summary + Popular Items imports and rendering)
- `app/admin/analytics/loading.tsx` — UPDATED (added Revenue Summary + Popular Items skeleton blocks)
- `tests/unit/admin/analytics/AnalyticsRevenueSummary.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsPopularItems.test.tsx` — NEW
- `tests/unit/admin/analytics/AnalyticsPopularItemRow.test.tsx` — NEW
- `tests/e2e/admin-analytics.spec.ts` — UPDATED (added two new test cases)

### Change Log

- 2026-05-20: Story 7.3 implemented — Revenue Summary tile, Popular Items section with expandable variant rows, loading skeleton updates, unit tests (27 new, 416 total), E2E extension

---

## Review Findings

_Code review run 2026-05-20 against commit `ccb9209`. Three layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. No AC violations; 4 patches, 3 deferred, ~20 dismissed as noise._

- [x] [Review][Patch] `pl-13` is not a valid Tailwind class — silently no-ops [components/admin/AnalyticsPopularItemRow.tsx:64] — fixed to `pl-12` (closest valid class in the default scale; tailwind.config.ts does not extend spacing).
- [x] [Review][Patch] `orderCount.toLocaleString()` with no locale arg → SSR/CSR hydration mismatch [components/admin/AnalyticsRevenueSummary.tsx:16] — fixed by pinning locale to `'en-US'`.
- [x] [Review][Patch] Region `aria-label` mismatches visible heading + hardcoded "Top 10" [components/admin/AnalyticsPopularItems.tsx:12-13] — fixed by replacing `aria-label="Top 10 popular items"` with `aria-labelledby` pointing at the `<h2>` (which now has `id="analytics-popular-items-heading"`). Accessible name now matches the visible "Popular Items" label. Test updated.
- [x] [Review][Patch] Loading skeleton row missing chevron placeholder → visual shift on hydration [app/admin/analytics/loading.tsx:67] — fixed by adding a `h-4 w-4` placeholder box at the end of each skeleton row.
- [x] [Review][Defer] KPI value spans have redundant aria-labels that double-announce [components/admin/AnalyticsRevenueSummary.tsx:24-46] — deferred, spec-mandated. Each KPI cell renders `<span>Total Revenue</span>` next to `<span aria-label="Total Revenue: $50.00">$50.00</span>`; screen readers announce "Total Revenue. Total Revenue: $50.00". Spec Task 1 line 67 explicitly mandates the per-value `aria-label="<label>: <value>"`. Flag for spec author review (drop aria-label on the value span, OR mark the label span `aria-hidden="true"` so only the inner aria-label is announced).
- [x] [Review][Defer] E2E "renders OR empty-state OR error" assertion is tautological [tests/e2e/admin-analytics.spec.ts:79-110] — deferred, matches established 7.2 pattern. `expect(hasRevenueSummary || hasEmptyState || hasError).toBe(true)` passes as long as any branch shows; the pre-existing test at line 72 already covers that. New tests add no incremental coverage in the data-positive case. Address project-wide if the E2E pattern is tightened in a future story.
- [x] [Review][Defer] Variant labels containing `" / "` corrupt the joined breakdown string [components/admin/AnalyticsPopularItemRow.tsx:24] — deferred, low-frequency edge. If a real variant is literally named `"salt / pepper"`, the breakdown becomes `salt / pepper: 7 / standard: 12` — visually unparseable. Spec mandates ` / ` as the separator (line 22). Address either by sanitizing variant labels at the data layer or by picking a more robust separator (e.g. `; ` or `<br>`-separated rows).
