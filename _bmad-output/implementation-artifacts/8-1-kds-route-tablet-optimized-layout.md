# Story 8.1: KDS Route & Tablet-Optimized Layout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want a dedicated kitchen display URL my staff can open on a tablet in the kitchen,
so that the kitchen has the order queue without sharing my owner Admin UI.

## Acceptance Criteria

1. **Given** an authenticated owner navigates to `/admin/kds`
   **When** the page renders
   **Then** the layout is full-screen, landscape-optimized, with **NO** admin nav chrome — neither the desktop left sidebar nor the mobile bottom tab bar is rendered — designed for tablet/wall display
   **And** a grid of `OrderTicket` slots is shown: 3 columns at ≥1024px (`lg:`), 2 columns below
   **And** the entire viewport (`min-h-screen`) is occupied — no admin layout `pb-16 lg:pl-56` padding is applied

2. **Given** the KDS is mounted
   **When** the global `RealtimeProvider` is already subscribed (from `/admin/layout.tsx`)
   **Then** the KDS page reads orders from the existing `useOrderStore` — **no** new Supabase channel is opened, **no** new `RealtimeProvider` is mounted
   **And** polling fallback at 4000ms is inherited from `RealtimeProvider` (consistent with Story 5.1) — the KDS does not implement its own fallback

3. **Given** the KDS is open on a tablet
   **When** the device is idle
   **Then** the screen does not auto-sleep — the page requests `navigator.wakeLock.request('screen')` on mount via the Screen Wake Lock JS API (W3C standard) in a Client Component
   **And** the wake lock is re-acquired on `visibilitychange` → `visible` (the API auto-releases when the tab is hidden)
   **And** the wake lock is released on unmount via the `WakeLockSentinel.release()` method
   **And** unsupported browsers (no `'wakeLock' in navigator`) degrade silently — no error toast, no console.error visible to the user (a `console.warn` is acceptable for debugging)
   **And** **owner sign-out is NOT triggered by idle** — there is no idle-timeout in this app; this AC is a defense against future regressions ("does not auto-dismiss or sign out")

4. **Given** the AdminNav is rendered on desktop (≥1024px)
   **When** the sidebar is shown
   **Then** a new "Kitchen" entry appears between "Tables" and "Analytics" (or at the end — flexible; see Task 1), linking to `/admin/kds`, using the `ChefHat` lucide icon
   **And** the entry is **NOT** rendered in the mobile bottom tab bar — kitchen staff bookmark the URL directly; owners reach it from desktop only

5. **Given** the route group / layout strategy
   **When** `/admin/kds` is rendered
   **Then** `app/admin/layout.tsx` still runs (auth gate + RealtimeProvider mount are preserved)
   **And** the chrome (`<AdminNav />` + `pb-16 lg:pl-56 lg:pb-0` wrapper) is conditionally **skipped** when `pathname === '/admin/kds'` or `pathname.startsWith('/admin/kds/')`
   **And** the conditional logic lives in a single Client Component (`AdminShell`) that wraps the children inside the layout — `/admin/layout.tsx` stays a Server Component for the Supabase auth gate

6. **Given** the KDS page renders before Story 8.2 ships
   **When** the grid is displayed
   **Then** it shows an empty-state panel (centred, large): "Waiting for orders" — quiet, no spinner, no animation other than the realtime cursor
   **And** when orders exist in `useOrderStore`, **placeholder ticket cards** are rendered (one card per active order — filtering by `received`/`preparing` status is deferred to Story 8.2 since the `status` column does not yet exist; for Story 8.1, render `useOrderStore.orders.filter((o) => !o.is_handled)`)
   **And** each placeholder card shows ONLY: table number, order time (via `formatRelativeTime`), and a `Coming in Story 8.2` muted note — this is intentional minimal scaffolding so the grid layout is visible during review

7. **Given** the page-level `loading.tsx` skeleton
   **When** the route is first loaded
   **Then** a skeleton matching the KDS layout renders: NO chrome (matches the no-chrome page), a 2/3-col grid of 6 ticket-shaped placeholders, full-viewport background
   **And** no spinners (per UX-DR12)

---

## Tasks / Subtasks

- [x] **Task 1 — Extend `AdminNav` with a desktop-only "Kitchen" entry** (AC: #4)
  - [x] Edit `components/admin/AdminNav.tsx`:
    - Add `ChefHat` to the `lucide-react` import (line 5).
    - Extend the `Tab` type / tabs array to support an optional `desktopOnly?: boolean` flag on each entry. The simplest shape:
      ```ts
      const tabs: Array<{ href: string; label: string; icon: typeof LayoutDashboard; exact: boolean; desktopOnly?: boolean }> = [
        ...existing,
        { href: '/admin/kds', label: 'Kitchen', icon: ChefHat, exact: false, desktopOnly: true },
      ]
      ```
    - In the mobile bottom-bar map (line 40), filter the array: `tabs.filter((t) => !t.desktopOnly).map(...)`
    - In the desktop sidebar map (line 80), use the unfiltered array (Kitchen appears here).
  - [x] Positioning: keep the existing visual order intact. Append "Kitchen" at the end of the tabs array (after "Settings") so it does not disturb existing tab order; this is acceptable per the AC ("flexible — between Tables and Analytics OR at the end").
  - [x] Active-state styling: `isActive('/admin/kds', false)` already covers it — no change needed; the desktop entry will gain the accent color when on `/admin/kds`.

- [x] **Task 2 — Introduce `AdminShell` Client Component for conditional chrome** (AC: #1, #5)
  - [x] Create `components/admin/AdminShell.tsx` — Client Component (`'use client'`):
    ```tsx
    'use client'
    import { usePathname } from 'next/navigation'
    import { AdminNav } from '@/components/admin/AdminNav'

    export function AdminShell({ children }: { children: React.ReactNode }) {
      const pathname = usePathname()
      const isKds = pathname === '/admin/kds' || pathname.startsWith('/admin/kds/')
      if (isKds) return <>{children}</>
      return (
        <div className="min-h-screen">
          <AdminNav />
          <div className="pb-16 lg:pl-56 lg:pb-0">{children}</div>
        </div>
      )
    }
    ```
  - [x] Edit `app/admin/layout.tsx` (lines 23–32):
    - Replace the inline chrome (`<div className="min-h-screen"><AdminNav />...</div>`) with `<AdminShell>{children}</AdminShell>`.
    - `RealtimeProvider` STILL wraps `<AdminShell>` — preserves global realtime subscription for KDS and all other admin routes.
  - [x] **DO NOT** restructure into route groups (`(with-chrome)/`, `(no-chrome)/`) — that would force moving every existing admin route. The AdminShell approach is contained.
  - [x] **DO NOT** remove the auth gate from `/admin/layout.tsx` — it's a Server Component check that still applies to `/admin/kds` (no separate gate needed in the KDS page).

- [x] **Task 3 — Create `/admin/kds/page.tsx` (Server Component, auth-aware shell)** (AC: #1, #6)
  - [x] Create `app/admin/kds/page.tsx` — Server Component. Mirrors the auth gate pattern from `app/admin/orders/page.tsx` (lines 7–16) for defense-in-depth, even though `/admin/layout.tsx` already gates it. **Justification**: layout guards do not run for Server Action endpoints — page-level checks remain the project convention.
    ```tsx
    import { createClient } from '@/lib/supabase/server'
    import { redirect } from 'next/navigation'
    import { KdsScreen } from '@/components/admin/KdsScreen'

    export default async function AdminKdsPage() {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) redirect('/auth/login')

      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .eq('id', user.id)
        .single()
      if (!profile?.restaurant_id) redirect('/auth/onboarding')

      return <KdsScreen />
    }
    ```
  - [x] No data fetching at the page level — `KdsScreen` reads from `useOrderStore` which is populated by `RealtimeProvider` (already mounted by `/admin/layout.tsx`).
  - [x] Page title / `<head>` metadata: add `export const metadata = { title: 'Kitchen — dine-in' }` to the page file for the browser tab. No `viewport` override beyond root `app/layout.tsx`.

- [x] **Task 4 — Create `KdsScreen` Client Component (grid + wake lock + empty state)** (AC: #1, #2, #3, #6)
  - [x] Create `components/admin/KdsScreen.tsx` — Client Component (`'use client'`).
  - [x] State: `const orders = useOrderStore((s) => s.orders)` and filter `const activeOrders = orders.filter((o) => !o.is_handled)`. (Story 8.2 will replace the `is_handled` filter with a `status` enum filter once that column exists.)
  - [x] Wake Lock — implement in a `useEffect`:
    ```tsx
    useEffect(() => {
      let sentinel: WakeLockSentinel | null = null
      let cancelled = false

      async function acquire() {
        if (!('wakeLock' in navigator)) return  // unsupported; silent
        try {
          sentinel = await navigator.wakeLock.request('screen')
        } catch {
          // user denied, low battery, or other policy denial — silent
        }
      }

      function handleVisibility() {
        if (document.visibilityState === 'visible' && !cancelled) acquire()
      }

      acquire()
      document.addEventListener('visibilitychange', handleVisibility)

      return () => {
        cancelled = true
        document.removeEventListener('visibilitychange', handleVisibility)
        sentinel?.release().catch(() => {})
      }
    }, [])
    ```
    - **`WakeLockSentinel` type**: the DOM lib types ship with TypeScript; if `tsc` does not resolve it, use `any` for the sentinel ref only — do NOT add a new dep. (The DOM types include `WakeLock` and `WakeLockSentinel` from TS 4.9+, and this project is on `^5`.)
    - **No retry-on-error loop** — wake-lock denial is permanent within a tab session; logging is optional.
  - [x] Layout (outermost wrapper of the KDS surface):
    ```tsx
    <main className="min-h-screen bg-surface-base px-4 py-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Kitchen</h1>
        <span className="text-xs text-text-secondary tabular-nums" aria-label={`${activeOrders.length} active orders`}>
          {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'}
        </span>
      </header>
      {activeOrders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <p className="text-base text-text-secondary">Waiting for orders</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {activeOrders.map((order) => (
            <KdsTicketPlaceholder key={order.id} order={order} />
          ))}
        </div>
      )}
    </main>
    ```
  - [x] `KdsTicketPlaceholder` (inline within the same file is fine — it's scaffolding only and will be replaced by Story 8.2's `OrderTicket`):
    ```tsx
    import { formatRelativeTime } from '@/utils/formatTime'
    function KdsTicketPlaceholder({ order }: { order: Order }) {
      return (
        <article className="rounded-lg border border-border bg-surface-raised p-4">
          <header className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-text-primary tabular-nums">Table {order.table_id ?? '—'}</span>
            <span className="text-xs text-text-secondary tabular-nums">{formatRelativeTime(order.submitted_at)}</span>
          </header>
          <p className="mt-2 text-xs italic text-text-secondary">Ticket UI coming in Story 8.2</p>
        </article>
      )
    }
    ```
    - **NOTE on `table_id`**: the realtime-fed `Order` carries `table_id` (uuid FK), not a human-readable table number. The orders feed elsewhere (e.g., OrderCard) resolves the table number via a separate query. For Story 8.1 scaffolding, render the FK directly — Story 8.2 will resolve it properly. Document this in the dev record.
  - [x] **Server vs Client split summary**: `page.tsx` (server) does auth gate; `KdsScreen.tsx` (client) does realtime consumption + wake-lock + grid render.

- [x] **Task 5 — Create `/admin/kds/loading.tsx` skeleton** (AC: #7)
  - [x] Create `app/admin/kds/loading.tsx`:
    ```tsx
    export default function KdsLoading() {
      return (
        <main className="min-h-screen bg-surface-base px-4 py-4">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="h-6 w-20 animate-pulse rounded bg-surface-overlay" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-overlay" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-overlay" />
            ))}
          </div>
        </main>
      )
    }
    ```
  - [x] No chrome (matches the no-chrome page rendering). `loading.tsx` is rendered INSIDE `AdminShell` — and since `AdminShell` already skips chrome on `/admin/kds`, the skeleton inherits that automatically.
  - [x] **DO NOT** add a spinner — UX-DR12 (skeletons, never spinners).

- [x] **Task 6 — Unit tests** (AC: #1, #4, #6)
  - [x] `tests/unit/admin/AdminShell.test.tsx`:
    - Mock `next/navigation`'s `usePathname` to return `/admin/orders` — expect children rendered inside the chrome wrapper (find `aria-label="Admin navigation"`).
    - Mock `usePathname` to return `/admin/kds` — expect children rendered WITHOUT the nav element (assert `container.querySelector('[aria-label="Admin navigation"]')` is null).
    - Mock `usePathname` to return `/admin/kds/whatever` — also no chrome (startsWith check).
  - [x] `tests/unit/admin/AdminNav.test.tsx`:
    - Add an assertion: in the mobile bottom-bar variant (`window.innerWidth < 1024` is irrelevant; instead query the `lg:hidden` nav element's children), confirm "Kitchen" link is NOT present.
    - In the desktop variant, confirm "Kitchen" link IS present and has `href="/admin/kds"`.
    - **Note from Story 7.2 patch P9/P10**: existing AdminNav test uses strict per-surface count assertions; bump those counts by 1 only in the desktop assertion (mobile remains the prior count).
  - [x] `tests/unit/admin/KdsScreen.test.tsx`:
    - Mock `useOrderStore` (use `vi.mock('@/stores/orderStore', ...)`).
    - When the store returns `orders: []`: renders "Waiting for orders" text; no `<article>` cards.
    - When the store returns 3 active orders: renders 3 `<article>` cards inside the grid; the header counter reads "3 orders".
    - When the store returns 1 active order: header reads "1 order" (singular).
    - Filtering: when store returns `[{ is_handled: false }, { is_handled: true }]`, only one card renders.
    - **Wake Lock**: stub `Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }, configurable: true })` — assert `request('screen')` was called on mount.
    - **No-wake-lock environment**: delete `navigator.wakeLock` for one test (`delete (navigator as any).wakeLock`) — confirm no error is thrown on mount.
    - **Vitest harness reminders** (per Story 7.2 debug-log): no `@testing-library/jest-dom`; use `.toBeTruthy()` / `.getAttribute()`. Wire `afterEach(cleanup)` at the top of every component test file.

- [x] **Task 7 — E2E smoke test** (AC: #1, #2, #4, #5)
  - [x] Create `tests/e2e/admin-kds.spec.ts`:
    - Sign in as a test owner via the shared helpers (mirror the pattern in `tests/e2e/admin-analytics.spec.ts`).
    - Navigate to `/admin/kds` — assert:
      - The page heading "Kitchen" is visible.
      - The admin sidebar (`aria-label="Admin navigation"` rendered in `lg:flex`) is **NOT** visible on the KDS page — Playwright should not find it.
      - The mobile bottom bar (`lg:hidden` element) is also not visible.
      - On a viewport ≥1024px, the grid container has `grid-cols-3` (verify by counting columns of rendered ticket placeholders, OR by reading the computed class list).
    - Navigate to `/admin/orders` (any non-KDS admin route) — assert the chrome IS rendered (sidebar present on `lg`+ viewport, bottom bar present on mobile viewport). This is the regression guard for the AdminShell branching.
    - **Do NOT** test wake-lock behavior in E2E (it requires HTTPS context and active user gesture; Playwright cannot reliably simulate this — covered in unit tests via stub).
  - [x] Do **not** add an RLS test — Story 8.1 introduces no schema changes, no new RLS surface.

- [ ] **Task 8 — Verification: manual + visual check**
  - [ ] Start the dev server (`npm run dev`), sign in as a test owner, visit `/admin/kds`.
  - [ ] Confirm the page is full-screen: no sidebar on desktop (≥1024px), no bottom bar on mobile (<1024px).
  - [ ] Resize the viewport at the `lg` breakpoint (1024px) — confirm grid switches between 2 and 3 columns cleanly with no horizontal scrollbar at any width.
  - [ ] Place a test order via the customer flow — confirm the placeholder card appears in the grid within 5s (RealtimeProvider should already be subscribed).
  - [ ] In Chrome DevTools → Application → Wake Lock: verify a screen wake lock is held while `/admin/kds` is the active tab; verify it auto-releases when the tab is hidden.
  - [ ] Tab away and back: confirm wake lock is re-acquired (visibilitychange handler).
  - [ ] In a browser without Wake Lock support (Safari < 16.4, or via DevTools "Disable wake lock" — none currently exists, so a manual override via `delete navigator.wakeLock` in the console): confirm no console error, page still works.
  - [ ] Visit `/admin/kds` on a non-owner account or with `?` URL params that should redirect — confirm the auth gate fires.
  - [ ] (Left for manual verification by user)

---

## Dev Notes

### Critical Context

**The "CSS wake-lock" wording in the epic AC is incorrect.** Wake Lock is a **JavaScript API** (`navigator.wakeLock.request('screen')`), part of the W3C Screen Wake Lock specification. There is no CSS feature called `wake-lock`. The implementation must use the JS API. The dev agent should mentally substitute "CSS wake-lock" → "Screen Wake Lock API (JS)" wherever the spec mentions it. Implementation lives in a Client Component because the API is browser-only and requires `useEffect` for mount/unmount management.

**KDS is the first tablet-optimized view in the codebase.** Per `ux-design-specification.md` line 894, the MVP rule is "Tablet: Same as mobile layout. No special tablet-optimised view for MVP." Story 8.1 is the deliberate Phase-2 departure from that rule — the KDS is **specifically** designed for a fixed tablet on the kitchen counter, and uses a `lg:` 3-column grid that is novel in this codebase for `/admin/*` routes. Do not "harmonize" this back to a single-column layout out of consistency. The novelty is the point.

**`RealtimeProvider` is already mounted globally for `/admin/*` — do not re-mount it.** It lives in `app/admin/layout.tsx` (line 24) and wraps every admin route. The KDS reads from the global `useOrderStore` (which `RealtimeProvider` populates via `setOrders`, `addOrder`, `updateOrder`). Mounting another `RealtimeProvider` would open a second Supabase channel — wasteful and risks duplicate `INSERT` callbacks. If you find yourself importing `RealtimeProvider` in a new file, you're going down the wrong path.

**Polling fallback is automatic — do not implement it again.** `RealtimeProvider` already implements `setInterval(refetchOrders, 4000)` (per Story 5.1) and toggles it on `CHANNEL_ERROR` / `CLOSED` / `TIMED_OUT`. Story 8.1 inherits this behavior. AC #2's "polling fallback at 4000ms remains the recovery path" is a behavioral inheritance, not a re-implementation task.

**Conditional chrome via `AdminShell` (NOT route groups).** Next.js's natural mechanism for "this route gets a different layout" is route groups (e.g., `app/(no-chrome)/admin/kds/`). Adopting that here would require **moving every existing admin route** (`orders`, `menu`, `tables`, `analytics`, `settings`, etc.) into a `(with-chrome)/` group to preserve their layouts. That diff is far larger than the value. Instead, this story uses a single Client Component (`AdminShell`) that reads `usePathname()` and conditionally renders the chrome. Net diff: one new file (~15 lines), one 3-line edit in `app/admin/layout.tsx`. Keep the `<RealtimeProvider>` wrapping `<AdminShell>` — auth + realtime stay above the chrome decision.

**Wake Lock is fragile by design.** The spec auto-releases on tab hide; it cannot be held across reloads; it requires HTTPS (so localhost works, http production deployments do not). Browser support: Chrome ≥ 84, Edge ≥ 84, Safari ≥ 16.4, Firefox does NOT support it as of 2026-05. The implementation MUST degrade silently — no toast, no error UI. This is Marco's kitchen tablet; a confusing modal would be worse than no wake-lock at all.

**`Order.table_id` is a uuid FK, not a human number.** Existing admin order surfaces (e.g., `OrderCard`) resolve `table_id` → `table_number` via a separate `tables` query. Story 8.1's placeholder card shows the raw FK with a fallback `'—'`; this is intentional scaffolding and is the seam Story 8.2 fills. Do NOT introduce a tables-resolve in Story 8.1.

**No new icons, no new deps.** `ChefHat` is already exported by `lucide-react` (the existing dep version `0.511.0`). No `npm install` is needed. Do not introduce `framer-motion`, a wake-lock library (e.g. `nosleep.js`), or any tablet-orientation library — none are needed.

**The "Kitchen" entry is desktop-only by spec.** AdminNav currently uses a single shared `tabs` array for both surfaces. Add a `desktopOnly?: boolean` discriminator on each tab entry; filter it out in the mobile bottom-bar map. This is the minimum-disruption way to support per-surface visibility. Do NOT split the tabs into two arrays — duplication causes drift when new tabs are added.

### Architecture Compliance

**Routing:**
- New route: `app/admin/kds/page.tsx` + `app/admin/kds/loading.tsx`. No route groups.
- Auth gate is duplicated at the page level (mirrors `/admin/orders/page.tsx`) — defense-in-depth per project convention; layout gates do not protect Server Action endpoints.

**Client selection** (see `docs/conventions/supabase-clients.md`):
- Page (Server Component) uses the server cookie client (`lib/supabase/server.ts` → `createClient()`) for the auth gate.
- KdsScreen (Client Component) does NOT touch Supabase directly — it reads only from `useOrderStore` (browser-side state populated by RealtimeProvider).
- **Do not** import `createAdminClient` here — owner identity is JWT-derived, not service-role.

**Server Action discipline** — N/A for this story; KDS is read-only and has no actions. (Story 8.3 introduces `advanceOrderStatus`.)

**Naming compliance:**
- Components: `AdminShell`, `KdsScreen`, `KdsTicketPlaceholder` — PascalCase.
- Files: PascalCase `.tsx` for components; lowercase `page.tsx` / `loading.tsx` per Next.js convention.
- Test files: `tests/unit/admin/<Name>.test.tsx`.
- Route: lowercase `/admin/kds`.

**Component directory placement:**
- `components/admin/AdminShell.tsx` — admin-only shell.
- `components/admin/KdsScreen.tsx` — admin-only KDS surface.
- **NOT** in `components/shared/` — KDS is exclusively an admin/owner surface for now.

**Price discipline** — N/A; KDS shows no prices (kitchen does not need them; matches OrderCard pattern of no prices on owner-side).

**Styling rules:**
- Tailwind only — no CSS-in-JS, no inline `style=` for layout.
- Design tokens only: `bg-surface-base`, `bg-surface-raised`, `bg-surface-overlay`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-accent`, `accent-muted`.
- Breakpoints: `sm` and `lg` only (per UX spec line 905). KDS grid uses `grid-cols-2 lg:grid-cols-3`.
- `tabular-nums` on numeric columns (order count, table number, time) — keeps the grid aligned during realtime updates.

**Anti-patterns to avoid:**
- Do **not** open a new Realtime channel — `RealtimeProvider` is global.
- Do **not** implement polling fallback again — `RealtimeProvider` already does it.
- Do **not** create a route group restructure — `AdminShell` is the contained solution.
- Do **not** add a wake-lock library — the W3C JS API is sufficient and supported by the target tablets (iPad Safari ≥ 16.4, Android Chrome ≥ 84).
- Do **not** redirect to `/auth/login` from `KdsScreen` (Client Component) — the auth gate is on the Server Component page.
- Do **not** inline `<style>` for the no-chrome viewport — Tailwind's `min-h-screen` + omitting `pb-16 lg:pl-56` is sufficient.
- Do **not** treat KDS as a "popup" or "modal" — it is a top-level route with full URL parity (deeplinkable, bookmarkable).
- Do **not** add an OFFLINE banner / network-status indicator (out of scope; covered separately in the project's existing realtime UX).

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`app/admin/layout.tsx`** — the file Task 2 modifies:
- Current: Server Component; auth gate via `getUser()` + profiles query; redirects on missing user or missing `restaurant_id`; wraps children in `<RealtimeProvider>` + inline chrome (`<AdminNav />` + padding div).
- What this story changes: the inline chrome `<div className="min-h-screen"><AdminNav /><div className="pb-16 lg:pl-56 lg:pb-0">{children}</div></div>` becomes `<AdminShell>{children}</AdminShell>`.
- What must be preserved: the auth gate (`getUser`, `profiles` SELECT, `redirect('/auth/login')`, `redirect('/auth/onboarding')`), the `<RealtimeProvider restaurantId={profile.restaurant_id}>` wrapping.

**`components/admin/AdminNav.tsx`** — the file Task 1 modifies:
- Current: Client Component; single `tabs` array (6 entries); identical iteration in mobile bottom-bar (`lg:hidden`) and desktop sidebar (`hidden lg:flex`); sign-out button at the end of each surface.
- What this story changes: add a 7th `tabs` entry with `desktopOnly: true`; filter the mobile mapping to exclude `desktopOnly` entries.
- What must be preserved: the `isActive()` helper, the `aria-current="page"` wiring, the `handleSignOut` flow, the `LogOut` button rendering on both surfaces.

**`components/shared/RealtimeProvider.tsx`** — read only; not modified:
- Mounts on `/admin/layout.tsx`; subscribes to Postgres `INSERT` and `UPDATE` on `orders` filtered by `restaurant_id`; falls back to polling every 4000ms when the channel is not `SUBSCRIBED`.
- Populates `useOrderStore` via `setOrders`, `addOrder`, `updateOrder`, `setRealtimeReady`.
- Token refresh is handled on `TOKEN_REFRESHED` event — Story 8.1 inherits this.

**`stores/orderStore.ts`** — read only; not modified:
- `useOrderStore` Zustand store exposing `orders`, `isRealtimeReady`, mutators.
- `orders` is sorted DESC by `submitted_at` (newest first) at insert/setOrders time. KDS will render newest-at-top by default — matches the AC.
- No status filtering built-in; consumers filter inline. Story 8.1 filters by `!is_handled`; Story 8.2 will switch to a `status` enum filter once 9.1 adds the column.

**`components/admin/OrderCard.tsx`** — reference for the placeholder ticket pattern (not for the KDS final UI):
- Pattern reused: `formatRelativeTime(order.submitted_at)`, `tabular-nums` on the time span, `text-text-secondary` on metadata.
- **Do NOT** import or reuse OrderCard inside KdsScreen — KDS is a separate surface with a different layout (large fonts, sparse, no expansion). Story 8.2 builds the dedicated `OrderTicket`.

**`app/admin/orders/page.tsx`** — reference for the auth gate pattern in `/admin/kds/page.tsx`:
- Lines 7–16 show the standard `createClient()` + `getUser()` + `profiles` SELECT + redirect chain. Copy this pattern verbatim into `app/admin/kds/page.tsx`.

**`utils/formatTime.ts`** — `formatRelativeTime(timestampString)` returns a short relative time string. Used by `OrderCard`; reused by the KDS placeholder card.

**`types/app.ts`** — `Order` type, includes `id`, `restaurant_id`, `table_id`, `items` (jsonb), `submitted_at`, `is_handled`, `handled_at`. KDS placeholder uses `table_id`, `submitted_at`, `is_handled`. No type changes required for Story 8.1.

**`tests/unit/admin/AdminNav.test.tsx`** — extend this file's existing per-surface assertions; do NOT replace them. The existing file (per Story 7.2 patch P9/P10) already asserts a specific count of items per surface; bump only the desktop count by 1.

**`tests/unit/admin/OrderCard.test.tsx`** — pattern reference for the new `KdsScreen.test.tsx`: imports `{ render, screen, cleanup, fireEvent }`, `afterEach(cleanup)`, plain `.getAttribute()` / `.toBeTruthy()` assertions.

**`tests/e2e/admin-analytics.spec.ts`** — pattern reference for the new `tests/e2e/admin-kds.spec.ts`: shared `signIn(page)` helper, page-navigation pattern, "render OR empty-state" assertion style.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `components/admin/AdminShell.tsx` | NEW | Client Component; conditionally renders chrome based on `usePathname()` |
| `components/admin/KdsScreen.tsx` | NEW | Client Component; reads `useOrderStore`, requests wake lock, renders grid + empty state + placeholder cards |
| `app/admin/kds/page.tsx` | NEW | Server Component; auth gate + renders `<KdsScreen />`; exports `metadata = { title: 'Kitchen — dine-in' }` |
| `app/admin/kds/loading.tsx` | NEW | Skeleton matching the no-chrome KDS layout (6 ticket placeholders, 2/3-col grid) |
| `app/admin/layout.tsx` | UPDATE | Replace inline chrome (`<AdminNav />` + padding wrapper) with `<AdminShell>{children}</AdminShell>` |
| `components/admin/AdminNav.tsx` | UPDATE | Add `desktopOnly?: boolean` flag on tab entries; add "Kitchen" entry with `desktopOnly: true`; filter mobile mapping |
| `tests/unit/admin/AdminShell.test.tsx` | NEW | Pathname-based chrome conditional |
| `tests/unit/admin/AdminNav.test.tsx` | UPDATE | Assert "Kitchen" link IS in desktop sidebar, NOT in mobile bottom bar |
| `tests/unit/admin/KdsScreen.test.tsx` | NEW | Empty-state, populated grid, count singularity, wake-lock stub |
| `tests/e2e/admin-kds.spec.ts` | NEW | End-to-end smoke: KDS renders, no chrome on KDS, chrome on other admin routes |

**No changes to:**
- `components/shared/RealtimeProvider.tsx` — already provides everything KDS needs.
- `stores/orderStore.ts` — no new state.
- `lib/supabase/server.ts` / `lib/supabase/admin.ts` / `lib/supabase/client.ts` — no client changes.
- `types/app.ts` — `Order` already has `table_id`, `submitted_at`, `is_handled`.
- `tailwind.config.ts` — default Tailwind breakpoints + existing tokens cover everything.
- Any SQL migration — no schema changes (8.1 is UI-only).
- `components/admin/OrderCard.tsx` — left untouched; KDS uses a separate placeholder pattern.

### Testing Standards

**Three test layers — three runners (project-context rule):**

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/admin/` | Vitest (`npm run test`) | `AdminShell`, `AdminNav` (extended), `KdsScreen` |
| RLS integration | n/a | — | **Not used** — no new DB access patterns; no RLS surface added |
| E2E | `tests/e2e/admin-kds.spec.ts` | Playwright (`npm run test:e2e`) | Smoke test: KDS renders + chrome guard regression |

**Vitest harness reminders (from Story 7.2 debug-log):**
- `@testing-library/jest-dom` is NOT installed — use `.toBeTruthy()`, `.getAttribute()`, `.textContent.includes(...)`.
- Add `import { afterEach } from 'vitest'` and `import { cleanup } from '@testing-library/react'` then `afterEach(cleanup)` at the top of every component test file.

**Mocking discipline:**
- Mock `next/navigation`'s `usePathname` for `AdminShell` tests: `vi.mock('next/navigation', () => ({ usePathname: () => '/admin/kds' }))` — change the return value per test by using `vi.mocked(usePathname).mockReturnValue(...)`.
- Mock `useOrderStore` for `KdsScreen` tests: `vi.mock('@/stores/orderStore', () => ({ useOrderStore: vi.fn() }))`, then per-test `vi.mocked(useOrderStore).mockReturnValue(/* orders array */)`.
- Stub `navigator.wakeLock` for the wake-lock test: `Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }) }, configurable: true })`; restore in `afterEach`.
- Do **not** mock the full RealtimeProvider — KdsScreen does not import it; it imports `useOrderStore` which is the right seam.
- Do **not** mock Supabase in unit tests — the page is a Server Component and is not unit-testable in Vitest; E2E covers integration.

**E2E rule:**
- Reuse `tests/rls/helpers.ts` `signIn(page)` (called from `tests/e2e/admin-analytics.spec.ts`).
- Do **not** mock Supabase in E2E — must hit local Supabase per project-context "real-DB smoke test required" rule.
- The E2E test does NOT need any seeded orders to verify chrome conditional behavior — visiting `/admin/kds` with an empty store should still pass the "no chrome" assertion.

### Previous Story Intelligence

**From Story 7.3 (Popular Items & Revenue Summary), code-review findings (2026-05-20):**
- **`pl-13` is not a valid default Tailwind class** — `tailwind.config.ts` does not extend `spacing`. If you reach for a number not in `{0,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,...}`, use an arbitrary value `pl-[Xrem]` instead. Patch P1 in 7.3 review fixed this. Story 8.1 uses only standard scale values (`px-4`, `py-4`, `pb-16`, `pl-56`, `gap-4`, etc.) — confirm before writing any class.
- **`toLocaleString()` on the server side must pin a locale** — `AnalyticsRevenueSummary` was patched to `toLocaleString('en-US')` to prevent SSR/CSR hydration mismatches. KdsScreen is a Client Component so this risk is lower, but the active-orders count uses no locale formatting (just a raw integer) — no issue.
- **`role="region"` + `aria-label` should match the visible heading** — Patch P3 in 7.3 review replaced `aria-label="Top 10 popular items"` with `aria-labelledby` pointing at the `<h2>`. Story 8.1's `<main>` and `<header>` use semantic HTML; no `role="region"` is added. The KDS heading is a plain `<h1>Kitchen</h1>` — no label-in-name mismatch risk.
- **Loading skeleton must match content layout** — Patch P4 in 7.3 added a chevron placeholder to the Popular Items skeleton row. KDS skeleton (Task 5) uses the same grid (`grid-cols-2 lg:grid-cols-3`) and the same card height — confirm visual parity manually.

**From Story 5.1 (Real-Time Order Feed with Polling Fallback):**
- `RealtimeProvider` was deliberately mounted at `/admin/layout.tsx` so every admin route inherits it. Story 8.1 sits within this contract — no new subscription.
- Polling fallback at 4000ms is the standard recovery cadence; KDS inherits it. Do not override.
- The `sortDesc` tie-break gap (per the deferred-work entry) means orders with identical `submitted_at` may swap on reload. **Story 8.2 will fix this** with a secondary `id` tiebreaker — Story 8.1 inherits the imperfect ordering.

**From Story 7.2 (Order Volume & Peak Hours Visualization):**
- AdminNav test (`AdminNav.test.tsx`) uses strict per-surface count assertions (patches P9, P10). When adding "Kitchen", bump the desktop count by 1 only — mobile count stays unchanged because Kitchen is `desktopOnly`.
- Server Components for the page shell, Client Components for interactive surfaces — this is the established Phase-2 admin pattern. KDS follows it: `page.tsx` (server) + `KdsScreen.tsx` (client).

### Latest Tech Information

- **Screen Wake Lock API**: W3C Candidate Recommendation as of 2025-12; widely deployed. Permission model: requires an active document (no permission prompt — browser silently denies in untrusted contexts). Auto-releases when the document becomes hidden; must be re-acquired on `visibilitychange` → `visible`. The `WakeLockSentinel` interface exposes `.released` (boolean) and `.release()` (Promise). Browser support: Chrome ≥ 84, Edge ≥ 84, Safari ≥ 16.4 (iOS + macOS), Android Chrome ≥ 84. **Firefox does NOT support it** as of 2026-05 — degrade silently. (Reference: [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).)
- **TypeScript DOM types**: `WakeLock`, `WakeLockSentinel`, `WakeLockType` ('screen') are included in TypeScript's `lib.dom.d.ts` since TS 4.9. This project is on `^5`, so `navigator.wakeLock.request('screen')` should type-check without any `@types/wakelock` package.
- **Next.js 15 / React 19**: `usePathname()` from `next/navigation` is the App Router hook for reading the current pathname inside Client Components. It returns a string and updates on navigation — fine for the AdminShell conditional.
- **Lucide-react `ChefHat`**: exported from `lucide-react` ≥ 0.300. Project dep is `^0.511.0` (per Story 7.2 added BarChart3). No install needed.
- **Cloudflare Workers compatibility**: `useEffect`, `navigator.wakeLock`, `document.addEventListener` all run in the browser, not on the Workers runtime. The Server Component `app/admin/kds/page.tsx` only calls `createClient()` + `getUser()` + Supabase SELECT — all edge-safe. No Node native APIs.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **Server-Component-by-default** — the page is server; only `KdsScreen` and `AdminShell` are `'use client'` (wake lock + pathname respectively).
- **Path alias `@/*`** — `@/components/admin/AdminShell`, `@/components/admin/KdsScreen`, `@/stores/orderStore`, `@/utils/formatTime`; never `../`.
- **Tailwind only, design tokens only** — no inline hex, no CSS-in-JS, no custom CSS. Use `accent`, `surface-raised`, `surface-overlay`, `surface-base`, `text-primary`, `text-secondary`, `border` tokens.
- **Breakpoints `sm` and `lg` only** — never `md` (per UX spec).
- **`createClient` is exported by both `lib/supabase/server.ts` and `lib/supabase/client.ts`** — the KDS page imports the **server** one for the auth gate; `KdsScreen` does not import Supabase at all (uses the store).
- **No spinners (UX-DR12)** — the loading state is a skeleton matching the layout exactly.
- **No new dependencies without asking** — `lucide-react` is existing; do not add `nosleep.js`, `framer-motion`, or any wake-lock helper library.
- **Comments default to none** — add a comment only when the WHY is non-obvious. The wake-lock `useEffect` is a candidate: a one-liner explaining the visibilitychange re-acquire is warranted.

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — sparse on Phase-2 KDS specifics; design decisions live in this story
- Epics: `_bmad-output/planning-artifacts/epics.md` lines 1081–1114 — source ACs for Story 8.1
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR49 (`/admin/kds` route), FR50 (sequence + prep priority — covered in 8.2/8.3, not 8.1), FR51 (bump-to-ready — 8.3)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` lines 884–910 — admin breakpoints; line 894's "no tablet-optimised view for MVP" is the rule this story deliberately departs from
- Project Context: `_bmad-output/project-context.md` — Technology Stack, Server-Component-first rule, Tailwind discipline, RealtimeProvider usage, `lib/supabase/server.ts` for admin auth, anti-patterns list
- Prior art: `_bmad-output/implementation-artifacts/5-1-real-time-order-feed-with-polling-fallback.md` — the RealtimeProvider + polling fallback contract this story inherits
- Prior art: `_bmad-output/implementation-artifacts/7-2-order-volume-peak-hours-visualization.md` — the AdminNav test patterns (strict per-surface counts), the Vitest harness reminders (no jest-dom, afterEach(cleanup)), the Server/Client component split convention
- Prior art: `_bmad-output/implementation-artifacts/7-3-popular-items-revenue-summary.md` — the no-`pl-13` lesson, the `aria-labelledby` over `aria-label` rule, the loading-skeleton layout-parity rule
- Prior art: `app/admin/layout.tsx` — the layout being modified
- Prior art: `components/admin/AdminNav.tsx` — the nav component being extended
- Prior art: `components/shared/RealtimeProvider.tsx` — read-only reference for the realtime contract KDS consumes
- Prior art: `app/admin/orders/page.tsx` — the auth gate pattern duplicated in `app/admin/kds/page.tsx`
- Prior art: `components/admin/OrderCard.tsx` — pattern source for `formatRelativeTime`, `tabular-nums`, text tokens (UI shape is intentionally NOT reused)
- MDN: Screen Wake Lock API — https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- W3C: Screen Wake Lock — https://www.w3.org/TR/screen-wake-lock/

---

## Dev Agent Record

### Agent Model Used

claude-opus-4-7

### Debug Log References

- **`a11y aria-label` on KDS header counter**: The spec snippet originally included `aria-label={`${activeOrders.length} active orders`}` on the order-count span, which would override the visible "N order(s)" text and read "0 active orders" / "3 active orders" for screen readers. Implementation omits this redundant `aria-label` — the visible text already conveys the count to AT; doubling it via aria-label was the same anti-pattern flagged in Story 7.3 review (double-announce). Left out intentionally.
- **`table_id` placeholder fallback**: Spec snippet showed `Table {order.table_id ?? '—'}`. `Order.table_id` is typed `string` (non-nullable) in `types/app.ts:116`, so the `??` is dead code. Implementation drops the fallback per project-context rule "Don't add error handling for scenarios that can't happen."
- **`vi.mock('@/stores/orderStore')` selector signature**: Required wrapping `useOrderStore` as `(selector) => selector({ orders })` to match the Zustand selector pattern used by `KdsScreen`. Returning `{ orders }` directly does not work because the component calls `useOrderStore((s) => s.orders)`.
- **`act(async () => {...})`**: Wake-lock tests trigger async state writes (the awaited `request('screen')` resolves after mount). Wrapping `render(...)` in `act` ensures the resulting state settles before assertions, avoiding "not wrapped in act" warnings.
- **`startsWith('/admin/kds/')` (with trailing slash)** in AdminShell — chose this over `startsWith('/admin/kds')` so a hypothetical future `/admin/kds-summary` route still gets chrome. Test covers this boundary.

### Completion Notes List

- Tasks 1–7 implemented; all 431 Vitest unit tests pass (14 new for this story). Task 8 (manual + visual check) left for user.
- **AdminNav** (`components/admin/AdminNav.tsx`): added `ChefHat` import, introduced `Tab` interface with optional `desktopOnly?: boolean` flag, appended "Kitchen" tab as `desktopOnly: true`, filtered mobile bottom-bar with `tabs.filter((t) => !t.desktopOnly)`. Desktop sidebar maps the unfiltered array so Kitchen appears there.
- **AdminShell** (`components/admin/AdminShell.tsx`): new Client Component reading `usePathname()`; renders raw `{children}` for `/admin/kds` (exact) or `/admin/kds/*` (startsWith with trailing slash); renders the prior chrome (`<AdminNav />` + `pb-16 lg:pl-56 lg:pb-0` padding) otherwise.
- **`/admin/layout.tsx`**: replaced inline chrome with `<AdminShell>{children}</AdminShell>`. RealtimeProvider continues to wrap AdminShell so KDS inherits the global subscription. Auth gate untouched.
- **`/admin/kds/page.tsx`**: Server Component with the standard auth gate (mirrors `/admin/orders/page.tsx`); exports `metadata = { title: 'Kitchen — dine-in' }`; renders `<KdsScreen />`.
- **`KdsScreen`** (`components/admin/KdsScreen.tsx`): Client Component. Reads `useOrderStore((s) => s.orders)`, filters `!is_handled`. Wake Lock implemented per spec — acquire on mount, re-acquire on `visibilitychange → visible`, release on unmount. Unsupported browsers (`!('wakeLock' in navigator)`) degrade silently. Grid is `grid-cols-2 lg:grid-cols-3`. Empty state shows "Waiting for orders" centered. `KdsTicketPlaceholder` (inline) shows table FK + relative time + "Coming in Story 8.2" hint.
- **`/admin/kds/loading.tsx`**: skeleton matching the KDS layout — 6 ticket placeholders in the 2/3-col grid, no chrome (AdminShell skips it automatically because `loading.tsx` renders at the same pathname).
- **Tests**:
  - `tests/unit/admin/AdminShell.test.tsx` (NEW, 4 tests): chrome on non-KDS, no chrome on `/admin/kds`, no chrome on nested KDS, chrome retained on similar-prefixed routes (`/admin/kds-summary-not-real`) — guards against accidental `startsWith('/admin/kds')` without slash.
  - `tests/unit/admin/AdminNav.test.tsx` (UPDATED): bumped desktop count by 1 to include "Kitchen"; added explicit assertion that mobile bottom bar has NO `a[href="/admin/kds"]` while desktop sidebar does.
  - `tests/unit/admin/KdsScreen.test.tsx` (NEW, 10 tests): empty state, populated grid, count singularity, `is_handled` filter, heading, wake-lock acquire / release / visibilitychange re-acquire, no-wake-lock graceful degradation.
  - `tests/e2e/admin-kds.spec.ts` (NEW, 5 tests): heading visible, no chrome on KDS, chrome retained on `/admin/orders` (regression guard), Kitchen link visible on desktop sidebar of other admin routes, empty-state shows "Waiting for orders". (Not run in this session — requires local Supabase + Next.js stack via `npm run test:e2e`.)
- **Lint**: `eslint` passes with zero warnings on all 6 touched source files.
- **Type-check**: `tsc --noEmit` passes on all Story 8.1 files. Pre-existing TS errors elsewhere in the project (`tests/unit/menu/MenuItemForm.test.tsx`, `tests/unit/tables/QrCodeDisplay.test.tsx`, `tests/unit/tables/tableActions.test.ts`) were not introduced by this story — confirmed via filtered grep.
- **Deviations from spec snippets**: (1) dropped the redundant `aria-label` on the order-count span (would have caused SR double-announce, same anti-pattern as 7.3-review patch P3); (2) dropped the `?? '—'` fallback on `order.table_id` (TS non-nullable). Both documented in Debug Log References above.

### File List

- `components/admin/AdminNav.tsx` — UPDATED (added ChefHat import, Tab interface, "Kitchen" entry with desktopOnly flag, filter on mobile mapping)
- `components/admin/AdminShell.tsx` — NEW (Client Component; pathname-conditional chrome)
- `components/admin/KdsScreen.tsx` — NEW (Client Component; useOrderStore consumer + wake lock + grid + placeholder cards)
- `app/admin/layout.tsx` — UPDATED (replaced inline chrome with `<AdminShell>`)
- `app/admin/kds/page.tsx` — NEW (Server Component; auth gate + page metadata + renders `<KdsScreen />`)
- `app/admin/kds/loading.tsx` — NEW (skeleton matching KDS layout, no chrome)
- `tests/unit/admin/AdminShell.test.tsx` — NEW (4 tests)
- `tests/unit/admin/AdminNav.test.tsx` — UPDATED (bumped desktop count assertion; added Kitchen-desktop-only assertion)
- `tests/unit/admin/KdsScreen.test.tsx` — NEW (10 tests)
- `tests/e2e/admin-kds.spec.ts` — NEW (5 tests)

### Change Log

- 2026-05-20: Story 8.1 implemented — AdminShell client component for conditional chrome, new `/admin/kds` route with Server Component auth gate, `KdsScreen` client component with screen wake lock (JS API), 2/3-col grid + empty state + placeholder cards, loading skeleton, AdminNav extended with desktop-only "Kitchen" entry, unit tests (14 new, 431 total Vitest), E2E smoke test (5 cases).
- 2026-05-20: Story 8.1 review patches (3 applied) — hardened wake-lock effect against rapid visibility flaps, unmount-during-pending-acquire, and browser auto-release; added `pathname` null guard to `AdminShell`; cleaned dead `flex flex-1` from KDS empty-state. Wake-lock unit tests updated: removed obsolete over-acquire assertion, added two precise tests (no-double-acquire, auto-release recovery). Full suite: 432 / 432 Vitest passing.

---

## Review Findings

_Code review run 2026-05-20 against the uncommitted working tree. Three layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. Acceptance Auditor: 0 AC violations, 0 anti-patterns. 3 patches, 8 deferred, ~16 dismissed._

- [x] [Review][Patch] Wake-lock effect leaks the sentinel on rapid visibility flaps and on unmount-during-pending-acquire [components/admin/KdsScreen.tsx:12-48] — fixed by (a) capturing the awaited sentinel in a local `next`, (b) checking `cancelled` after the await and releasing if cancelled, (c) adding an `acquiring` lock + `if (sentinel || acquiring) return` short-circuit so concurrent acquire() calls do not double-acquire, (d) subscribing to the sentinel's `release` event so a browser auto-release (low battery / OS policy) clears the ref and allows the next visibilitychange to recover. Two new unit tests added: "does not double-acquire when visibilitychange fires while sentinel is held" and "re-acquires wake lock after browser auto-releases sentinel". Obsolete test removed (was asserting the previous over-acquire behavior).
- [x] [Review][Patch] `usePathname()` can return `null`; `pathname.startsWith(...)` would throw [components/admin/AdminShell.tsx:9] — fixed by `pathname != null && (pathname === '/admin/kds' || pathname.startsWith('/admin/kds/'))`. Default branch when null is "show chrome" (safer fallback).
- [x] [Review][Patch] Empty-state `flex flex-1` is dead — `<main>` is not a flex container [components/admin/KdsScreen.tsx:55] — fixed by replacing `flex flex-1 items-center justify-center py-24` with `py-24 text-center`. Same visual outcome (centered "Waiting for orders" text), no dead classes.
- [x] [Review][Defer] Placeholder cards render the raw `table_id` UUID instead of a human-readable table number [components/admin/KdsScreen.tsx:62] — deferred, Story 8.2 territory. The dev-record explicitly notes this as scaffolding: "Story 8.2 will resolve it properly via a tables lookup."
- [x] [Review][Defer] `formatRelativeTime` is not auto-refreshed; "5m ago" stays stale until the next realtime update [components/admin/KdsScreen.tsx:59] — deferred. Story 8.2 ACs include "elapsed time updates every 30s" — implementation belongs there, not 8.1.
- [x] [Review][Defer] `isRealtimeReady === false` on mount is indistinguishable from real empty-state [components/admin/KdsScreen.tsx:8] — deferred. Until orders are hydrated, "Waiting for orders" shows in both states. Could differentiate with a "Connecting..." mode. Low-frequency since first-load typically finishes within polling-fallback interval.
- [x] [Review][Defer] No aria-live on the KDS grid; new orders are not announced to assistive tech [components/admin/KdsScreen.tsx:30-54] — deferred. Kitchen wallscreens rarely have screen readers attached; defer until a broader admin-UI a11y pass.
- [x] [Review][Defer] Unit-test gap: `cancelled` guard not explicitly verified [tests/unit/admin/KdsScreen.test.tsx] — deferred. The visibility-change re-acquire test fires AFTER mount only; there's no test that asserts "no re-acquire fires AFTER unmount when visibilitychange happens to fire". Adds coverage but no current behavior depends on this.
- [x] [Review][Defer] `AdminNav.isActive(href, false)` over-matches similar-prefix routes [components/admin/AdminNav.tsx:31-33] — deferred, pre-existing. `pathname.startsWith(href)` would highlight Kitchen on a hypothetical `/admin/kds-summary` route, and the same applies to Orders/Menu/Tables/Analytics/Settings. Cross-cutting fix; not introduced by Story 8.1.
- [x] [Review][Defer] Loading skeleton has no `role="status"` / `aria-busy` / `aria-live` [app/admin/kds/loading.tsx] — deferred. Same pattern as all other admin loading.tsx files; cross-cutting a11y change, not 8.1-scoped.
- [x] [Review][Defer] `profiles.single()` PGRST116 path is not explicitly handled [app/admin/kds/page.tsx:11-19] — deferred, pre-existing. Same auth-gate pattern used in every `/admin/*` page. Cross-cutting fix.
