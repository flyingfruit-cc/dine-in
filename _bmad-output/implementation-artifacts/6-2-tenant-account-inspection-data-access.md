# Story 6.2: Tenant Account Inspection & Data Access

Status: done

## Story

As a platform admin,
I want to inspect any tenant's account details and access their data,
so that I can diagnose and resolve support issues without needing the restaurant owner to be present.

## Acceptance Criteria

1. **Given** the platform admin selects a restaurant from the tenant list
   **When** they navigate to `/platform/tenants/[restaurant_id]`
   **Then** the tenant detail page shows: restaurant name, slug, owner email, signup date, published status, table count, and menu item count (FR41)

2. **Given** the platform admin is on a tenant detail page
   **When** they access the tenant's data
   **Then** they can view that restaurant's menu items, tables, and recent orders (FR42)
   **And** this access is granted via the `is_platform_admin` server-side check — the owner's RLS policies are bypassed using the service role client

3. **Given** the platform admin views a tenant's configuration
   **When** the QR codes are checked
   **Then** the admin can verify table configuration and QR URL correctness — addressing the Journey 4 support scenario directly

4. **Given** the platform admin accesses this page
   **When** the data is fetched
   **Then** all queries are scoped to the specific `restaurant_id` — the admin sees one tenant at a time, never a cross-tenant dump

---

## Tasks / Subtasks

- [x] **Task 1 — Update `components/platform/TenantList.tsx` — clickable rows linking to detail page** (AC: #1 navigation)
  - [x] Import `Link` from `next/link`
  - [x] Wrap each restaurant row content in `<Link href={`/platform/tenants/${r.id}`}>` so clicking a restaurant navigates to the detail page
  - [x] Apply hover state on the `<li>`: `hover:bg-surface-raised transition-colors` and `cursor-pointer` so the row feels interactive
  - [x] Keep existing row layout (name, slug, signup date, badge) — no structural changes
  - [x] Add one new unit test in `tests/unit/platform/TenantList.test.tsx`: assert each restaurant row renders a link (`<a>`) with `href` containing the restaurant id

- [x] **Task 2 — `app/platform/tenants/[restaurant_id]/page.tsx` — Tenant detail Server Component** (AC: #1, #2, #3, #4)
  - [x] Create `app/platform/tenants/[restaurant_id]/page.tsx` as a Server Component (no `'use client'`)
  - [x] Accept `params: { restaurant_id: string }` from the Next.js route segment
  - [x] Use `createAdminClient()` from `@/lib/supabase/admin` for ALL data fetches — service role bypasses RLS for cross-tenant reads
  - [x] Fetch restaurant row: `.from('restaurants').select('id, name, slug, created_at, is_published').eq('id', restaurantId).single()` — call `notFound()` from `next/navigation` if `data` is null (invalid or missing restaurant_id)
  - [x] Fetch owner profile: `.from('profiles').select('id').eq('restaurant_id', restaurantId).single()` — store the `id` as `ownerId`
  - [x] Fetch owner email: `supabase.auth.admin.getUserById(ownerId)` → `user?.email` — show `—` if null/missing (restaurant may have no owner yet)
  - [x] Fetch tables list: `.from('tables').select('id, number, created_at').eq('restaurant_id', restaurantId).order('number')` — ALL for QR verification
  - [x] Fetch menu items: `.from('menu_items').select('id, name, price_cents').eq('restaurant_id', restaurantId).order('name')` — ALL items (menu_items has no is_published column per generated types)
  - [x] Fetch recent orders: `.from('orders').select('id, submitted_at, is_handled, items').eq('restaurant_id', restaurantId).order('submitted_at', { ascending: false }).limit(20)` — last 20
  - [x] Run independent fetches in parallel via `Promise.all([ ... ])` for performance
  - [x] Page layout:
    - Back link: `<Link href="/platform/tenants">← Tenants</Link>` above the page heading
    - Heading: `<h1>{restaurant.name}</h1>` with slug below
    - Summary section: owner email, signup date (formatted via `toLocaleDateString()`), published status badge, table count, menu item count
    - Tables section (`<h2>Tables</h2>`): list each table's number and QR URL (`generateQrUrl(restaurant.slug, table.number)`) — key data for Journey 4 QR support verification
    - Menu Items section (`<h2>Menu Items ({count})</h2>`): list each item's name, `formatPrice(price_cents)`
    - Recent Orders section (`<h2>Recent Orders</h2>`): list up to 20 orders — submitted time, handled/pending status, item summary
  - [x] Tailwind tokens — do NOT hardcode hex; follow established tokens:
    - `bg-accent text-white` — Published badge
    - `bg-border text-text-secondary` — Offline / Pending / Handled badge
    - `text-text-primary`, `text-text-secondary`, `bg-surface-base`, `bg-surface-raised`
    - `divide-y divide-border` for lists

- [x] **Task 3 — E2E test for tenant inspection** (AC: #1, #2, #3, #4)
  - [x] Create `tests/e2e/platform-tenant-inspection.spec.ts`
  - [x] `beforeAll`: creates test restaurant + restaurant B (scoping), owner, platform admin; seeds 1 table, 1 menu item, 1 order
  - [x] `afterAll`: `cleanupTestRestaurants(svc, [restaurant.id, restaurantB.id])` + `cleanupTestUsers(svc, [adminId])`
  - [x] `signIn(page, adminEmail)` helper — goto `/auth/login`, fill email + password, click login, `waitForURL(/\/admin/)`
  - [x] **Test 1 — Navigate from tenant list to detail page via row link**: sign in, goto `/platform/tenants`, click restaurant name, `waitForURL`, assert URL contains restaurant id
  - [x] **Test 2 — Detail page shows summary fields**: assert restaurant name, slug, owner email, signup year, published badge, table count all visible
  - [x] **Test 3 — Detail page shows tables with QR URL**: assert Tables heading, "Table 1", QR URL containing `{slug}/1` visible
  - [x] **Test 4 — Detail page shows menu items and orders**: assert "Test Item", "$15.00", "Pending" badge visible
  - [x] **Test 5 — Scoping**: assert restaurant B's name is NOT visible on restaurant A's detail page

### Review Findings (2026-05-18)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) returned ~60 raw findings. After dedupe + triage: 0 decision-needed, 9 patches, 8 deferred, 15 dismissed.

**Patch (unchecked):**

- [x] [Review][Patch] **Owner profile `.single()` errors on 0 or 2+ rows** [app/platform/tenants/[restaurant_id]/page.tsx:27-31] — PGRST116 thrown when restaurant has no owner profile (or multiple). Switch to `.maybeSingle()` so null is returned gracefully.
- [x] [Review][Patch] **Empty/malformed UUID for restaurant_id crashes 5 queries** [app/platform/tenants/[restaurant_id]/page.tsx:12,23] — `/platform/tenants/garbage` causes Postgres 22P02 invalid_uuid. Validate UUID format and call `notFound()` early before queries.
- [x] [Review][Patch] **`getUserById` called with empty string when no owner exists** [app/platform/tenants/[restaurant_id]/page.tsx:51-53] — `ownerProfile?.id ?? ''` passes `''` to the admin auth API. Skip the auth call entirely when no profile id exists.
- [x] [Review][Patch] **`getUserById` data:null destructure crashes; error field discarded** [app/platform/tenants/[restaurant_id]/page.tsx:51-54] — when the API errors, `data` is null and `data: { user }` throws TypeError. Capture `error`, defensively access `user`, fall back to `'—'`.
- [x] [Review][Patch] **`order.items` unsafe cast crashes on null/object/missing-name** [app/platform/tenants/[restaurant_id]/page.tsx:170-171] — `items as unknown as OrderItem[]` lies about runtime shape. If items is null/object or has unnamed entries, `.map(i => i.name).join(', ')` crashes or yields `', , '`. Guard with `Array.isArray(items) ? items.filter(i => i?.name) : []`.
- [x] [Review][Patch] **TenantList `<Link>` has no focus-visible style; keyboard users get no focus ring** [components/platform/TenantList.tsx:44-48] — visible hover is on `<li>` but focus target is the inner `<Link>`. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent` (or equivalent on the li via `:focus-within`) so keyboard tab order is visible.
- [x] [Review][Patch] **E2E `getByText('1').first()` brittle — matches '1' in slug suffix, "Table 1", QR URL "/1"** [tests/e2e/platform-tenant-inspection.spec.ts:90-91] — the digit "1" appears all over the page (restaurant suffix from `Date.now()`, slug, table label, QR URL). Scope the assertion to the summary `<dl>` (e.g., `page.locator('dl').getByText('1').first()`) or assert against the "Tables" `<dt>`/`<dd>` pair.
- [x] [Review][Patch] **QR URL `break-all` shatters URLs mid-token** [app/platform/tenants/[restaurant_id]/page.tsx:131] — `break-all` breaks mid-slug, making URLs unreadable. Use `break-words` (line-break only at safe points) — same content, far more scannable.
- [x] [Review][Patch] **Order summary drops `quantity` and `variants` from OrderItem** [app/platform/tenants/[restaurant_id]/page.tsx:170-171] — `OrderItem` has `quantity: number` and `variants: string[]`. Current `.map(i => i.name).join(', ')` renders `"Pizza, Pizza"` for 5 pizzas. For a support inspection tool, include quantity (e.g., `Pizza × 3`).

**Deferred (real but out of MVP scope or project-wide pattern):**

- [x] [Review][Defer] **Server Component discards Supabase error from queries** [app/platform/tenants/[restaurant_id]/page.tsx:22-55] — same shape as 6.1 deferred item; if `restaurants` query errors, `notFound()` masks a real outage. Project-wide error-UX design decision.
- [x] [Review][Defer] **`Promise.all` rejection aborts entire page render** [app/platform/tenants/[restaurant_id]/page.tsx:22-55] — one transient DB/network failure crashes the whole page. `Promise.allSettled` would degrade gracefully but requires a project-wide error-rendering pattern.
- [x] [Review][Defer] **No support for multi-owner restaurants** [app/platform/tenants/[restaurant_id]/page.tsx:27-31] — schema technically allows multiple `profiles` per `restaurant_id`. The `.maybeSingle()` patch picks one; rendering an owner list is out of MVP scope.
- [x] [Review][Defer] **No `Suspense` boundary; entire page hangs on slowest query** [app/platform/tenants/[restaurant_id]/page.tsx:14-198] — same pattern as all existing pages (admin/orders, admin/menu). Project-wide streaming refactor.
- [x] [Review][Defer] **`toLocaleDateString()`/`toLocaleTimeString()` are locale/timezone dependent** [app/platform/tenants/[restaurant_id]/page.tsx:89-91, 177-178] — same as 6.1 deferred item; future fix uses `Intl.DateTimeFormat` with explicit locale + timezone.
- [x] [Review][Defer] **E2E `beforeAll` failure leaves orphaned data; `afterAll` references possibly-undefined vars** [tests/e2e/platform-tenant-inspection.spec.ts:22-50] — same shape as all existing e2e tests. Project-wide test harness improvement.
- [x] [Review][Defer] **Published/Offline badge conveys state via color only; aria-label/contrast not audited** [app/platform/tenants/[restaurant_id]/page.tsx:96-104, components/platform/TenantList.tsx:54-63] — same as 6.1 deferred item; a11y polish.
- [x] [Review][Defer] **No pagination/total-count for orders; admin can't tell whether 20-limit truncates** [app/platform/tenants/[restaurant_id]/page.tsx:54] — same shape as 6.1's "No pagination on tenant list" deferred item.

**Dismissed (15):** Blind #1/#2/#15 + Edge #17 missing auth check (the `app/platform/layout.tsx` guard from Story 6.1 covers all `/platform/*` nested routes via Next.js layout cascade — documented in story Dev Notes; Blind Hunter has no project context by design); Blind #13 signIn awaits `/admin/` (correct per spec — owners and platform admins both land on `/admin` first by login default; matches 6.1 e2e pattern); Blind #16 TypeScript narrowing after `notFound()` (notFound() returns `never` in Next 14+; TS narrows correctly — page compiles); Blind #19 dead/duplicate count display (intentional — section headings repeat count for scannability); Edge #9/#10/#11/#16/#20 nullable `created_at`/`number`/`price_cents`/`submitted_at`/`name`/`slug` (all non-null per generated `types/supabase.ts`); Edge #19 r.id URL-unsafe characters (UUIDs are URL-safe by definition); Auditor: tables heading shows `({count})` additively (acceptable additive enhancement, satisfies AC); Auditor: missing explicit `cursor-pointer` (`<Link>` renders as `<a>`, browser default `cursor: pointer`); Auditor: Pending badge uses `bg-accent text-white` (matches existing `components/admin/OrderCard.tsx` convention where unhandled=accent — established UX pattern overrides spec's incomplete tokens list); Auditor: sprint-status.yaml not in diff (informational only, review metadata).

---

## Dev Notes

### Critical Context

**Builds directly on Story 6.1.** The `app/platform/layout.tsx` guard is already in place — any page under `app/platform/` automatically requires `is_platform_admin: true`. Do NOT re-implement the guard in the detail page.

**Admin client pattern established**: `createAdminClient()` at `lib/supabase/admin.ts` uses the service role key and bypasses RLS. Already used in `app/platform/tenants/page.tsx`. Use the identical import: `import { createAdminClient } from '@/lib/supabase/admin'`.

**Owner email via auth admin API**: `profiles` table stores the user UUID (`id`) but not the email — email lives in `auth.users`. Retrieve it server-side:
```typescript
const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(ownerId)
const ownerEmail = ownerUser?.email ?? '—'
```
The service role client's `auth.admin` API allows this without an additional API call. This is the only supported server-side way to read `auth.users.email` in Supabase.

**Parallel data fetches with Promise.all**: The page makes 5+ independent queries. Use `Promise.all` to avoid sequential waterfall:
```typescript
const [
  { data: restaurant },
  { data: ownerProfile },
  { data: tables },
  { data: menuItems },
  { data: orders },
] = await Promise.all([
  supabase.from('restaurants').select(...).eq('id', restaurantId).single(),
  supabase.from('profiles').select('id').eq('restaurant_id', restaurantId).single(),
  supabase.from('tables').select(...).eq('restaurant_id', restaurantId).order('number'),
  supabase.from('menu_items').select(...).eq('restaurant_id', restaurantId).order('name'),
  supabase.from('orders').select(...).eq('restaurant_id', restaurantId).order('submitted_at', { ascending: false }).limit(20),
])
if (!restaurant) notFound()
const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(ownerProfile?.id ?? '')
const ownerEmail = ownerUser?.email ?? '—'
```
Note: `getUserById` must happen AFTER `ownerProfile` resolves since it depends on the `id`. The `Promise.all` block covers the 5 parallel DB queries; `getUserById` runs sequentially after.

**QR URL construction**: Use existing `generateQrUrl` utility:
```typescript
import { generateQrUrl } from '@/utils/generateQrUrl'
// In tables list:
generateQrUrl(restaurant.slug, table.number)
// Returns: `${NEXT_PUBLIC_APP_URL}/${slug}/${tableNumber}` e.g. "https://app.dine-in-cc.com/burger-palace/1"
```
Show this URL in the tables section — it's the key data for Journey 4 QR debugging.

**Order items are JSONB**: The `orders.items` column is `jsonb` typed as `OrderItem[]` in `types/app.ts`:
```typescript
interface OrderItem { name: string; price_cents: number; /* variant info */ }
```
For the recent orders section, render a simple text summary — join item names: `order.items.map(i => i.name).join(', ')`. Don't render full variant detail — this is a support inspection view.

**`notFound()` for invalid restaurant**: If the `restaurant_id` param does not match any restaurant, call `notFound()` from `next/navigation`. This triggers Next.js's built-in 404 page (or `app/not-found.tsx` if present). Do NOT redirect to `/platform/tenants` — `notFound()` is the correct pattern for invalid dynamic route segments.

**No mutations in this story**: The detail page is pure read. No Server Actions, no `ActionResult<T>` pattern needed. All data via `createAdminClient()` direct queries.

### Architecture Compliance

**Client selection** (see `docs/conventions/supabase-clients.md`):
- The `app/platform/layout.tsx` already used `createClient()` for the auth/admin check — do NOT re-use `createClient()` in the detail page
- `app/platform/tenants/[restaurant_id]/page.tsx`: `createAdminClient()` exclusively — all queries must bypass RLS to read cross-tenant

**Tailwind tokens** — same tokens as Story 6.1:
- `bg-accent text-white` — Published badge
- `bg-border text-text-secondary` — Offline / Pending / Handled badge
- `text-accent` — for links (back nav)
- `text-text-primary`, `text-text-secondary`, `bg-surface-base`, `bg-surface-raised`, `divide-y divide-border`
- `font-mono text-xs` — for QR URLs (monospace makes them easier to inspect)

**`next/link` in TenantList**: Import `Link` from `next/link`. Since `TenantList.tsx` is already `'use client'`, `next/link` works as a standard anchor in tests and prod. In jsdom unit tests, `<Link href="...">` renders as `<a href="...">` — assert with `screen.getByRole('link', { name: ... })`.

**No shared layout changes**: The `app/platform/layout.tsx` shell (`<div className="min-h-screen bg-surface-base">`) wraps the detail page automatically. No new layout needed.

**params type in Next.js App Router**: The `params` prop in a Next.js 14+ page component is typed as:
```typescript
export default async function TenantDetailPage({
  params,
}: {
  params: { restaurant_id: string }
}) { ... }
```
`restaurant_id` is always a string from the URL — it won't be undefined.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`components/platform/TenantList.tsx`** — Task 1 modifies this:
- Current shape: `<ul>` with `<li key={r.id}>` containing `<div className="flex items-center justify-between gap-4">` with name/slug/date and badge
- Wrap the inner `<div>` in `<Link href={`/platform/tenants/${r.id}`} className="flex items-center justify-between gap-4 hover:bg-surface-raised transition-colors cursor-pointer">` — remove the `className` from the `<div>` and apply it to the `<Link>` instead, OR keep the `<div>` inside `<Link>` and add hover to `<li>`: `className="py-3 hover:bg-surface-raised transition-colors rounded-md"`

**`app/platform/tenants/page.tsx`** — reference for admin client pattern:
```typescript
const supabase = createAdminClient()
const { data } = await supabase.from('restaurants').select(...)
```

**`utils/generateQrUrl.ts`**: `generateQrUrl(slug: string, tableNumber: number): string` — uses `NEXT_PUBLIC_APP_URL` env var, falls back to `https://app.dine-in-cc.com`

**`utils/formatPrice.ts`**: `formatPrice(priceCents: number): string` — returns `$XX.XX`

**`tests/e2e/platform-admin-access.spec.ts`** — E2E spec pattern to replicate exactly:
- `test.describe` wrapper with `beforeAll`/`afterAll`
- `const svc = getServiceClient()` at describe scope
- `const suffix = `ti-${Date.now()}`` (use unique prefix per spec — use `ti-` for tenant-inspection)
- `signIn(page, email)` helper: goto login, fill, click, `waitForURL(/\/admin/)`
- `cleanupTestRestaurants(svc, [...])` + `cleanupTestUsers(svc, [...])` in `afterAll`

**`tests/rls/helpers.ts`** — ALL helpers already available; no new helpers needed for this story:
- `createTestRestaurant`, `createTestOwner`, `createTestPlatformAdmin`, `cleanupTestRestaurants`, `cleanupTestUsers`
- Service client seeding via: `svc.from('tables').insert(...)`, `svc.from('menu_items').insert(...)`, `svc.from('orders').insert(...)`

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `components/platform/TenantList.tsx` | UPDATE | Add `Link` wrapper on each row |
| `app/platform/tenants/[restaurant_id]/page.tsx` | NEW | Server Component, admin client, full tenant data display |
| `tests/unit/platform/TenantList.test.tsx` | UPDATE | Add link assertion test |
| `tests/e2e/platform-tenant-inspection.spec.ts` | NEW | Full E2E inspection flow, 5 tests |

### Testing Standards

- Unit: `vitest --run`, `@testing-library/react`, jsdom — colocate with `tests/unit/platform/TenantList.test.tsx`
  - `<Link>` from `next/link` renders as `<a>` in jsdom — use `screen.getByRole('link')` or `within(row).getByRole('link')`
- E2E: Playwright, `tests/e2e/*.spec.ts`, requires live Supabase instance (`supabase start`)
  - Pattern: follow `tests/e2e/platform-admin-access.spec.ts` exactly
  - Suffix: `ti-${Date.now()}` (tenant inspection)
- No new RLS tests needed — `tests/rls/platform-admin.spec.ts` covers RLS enforcement; `createAdminClient()` bypass is architectural, not a new RLS policy change

### Previous Story Intelligence (from 6.1)

- `createTestPlatformAdmin` is in `tests/rls/helpers.ts` — no need to re-add
- `signIn` helper in E2E specs awaits `page.waitForURL(/\/admin/)` after login click — replicate this exactly
- `cleanupTestRestaurants` cascades through child rows (orders → tables → menu_items → categories → profiles → auth.users) — just pass restaurant ids to `afterAll`
- Code-review deferred: "No CSRF/auth check pattern for future /platform Server Actions" — this story has NO Server Actions, so no mutations to protect. If a future story adds mutations, they MUST independently re-check `is_platform_admin`.
- Code-review deferred: "Page Server Component admin-client query may execute even when layout redirects" — same pattern applies to the detail page; acceptable for MVP per established precedent.
- `TenantRow` interface is exported from `components/platform/TenantList.tsx` — if any new types are needed for the detail page, define them locally in the detail page file (not in TenantList.tsx, which is about the list, not the detail).

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Platform Admin directory, Database Schema, Testing Standards
- Epics: `_bmad-output/planning-artifacts/epics.md` — Epic 6, Story 6.2 AC (FR41, FR42)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — Journey 4 (Nic — Platform Admin Support)
- Story 6.1: `_bmad-output/implementation-artifacts/6-1-platform-admin-access-tenant-list.md` — all established patterns

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript revealed `menu_items` has no `is_published` column in generated types — removed from select query and display. Column exists in architecture spec but not in the DB migration. Story dev notes updated to reflect actual schema.
- `order.items` jsonb requires `as unknown as OrderItem[]` double cast — direct cast from `Json` is not allowed by TypeScript.

### Completion Notes List

- Task 1: Updated `components/platform/TenantList.tsx` — imported `next/link`, wrapped each `<li>` content in `<Link href="/platform/tenants/${r.id}">` with hover state (`hover:bg-surface-raised transition-colors rounded-md`). Added 1 unit test asserting link href contains restaurant id. All 13 unit tests pass.
- Task 2: Created `app/platform/tenants/[restaurant_id]/page.tsx` — Server Component using `createAdminClient()` for all data fetches. Parallel `Promise.all` for 5 DB queries (restaurant, owner profile, tables, menu_items, orders), then sequential `auth.admin.getUserById` for owner email. `notFound()` guard on missing restaurant. Shows: Account Summary card (email, signup date, status badge, counts), Tables section with QR URLs via `generateQrUrl`, Menu Items section with `formatPrice`, Recent Orders section with item summary + Pending/Handled badge.
- Task 3: Created `tests/e2e/platform-tenant-inspection.spec.ts` with 5 tests covering: row-link navigation, summary fields, QR URL verification, menu items + orders, and scoping. `beforeAll` seeds table + menu item + order for the test restaurant; `beforeAll` also creates a second restaurant to verify scoping.
- 330/330 unit tests pass throughout — no regressions.

### File List

- `components/platform/TenantList.tsx` (UPDATE — added Link wrapper + hover state)
- `app/platform/tenants/[restaurant_id]/page.tsx` (NEW)
- `tests/unit/platform/TenantList.test.tsx` (UPDATE — added link assertion test)
- `tests/e2e/platform-tenant-inspection.spec.ts` (NEW)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-05-18: Implemented Story 6.2 — Tenant Account Inspection & Data Access. Made TenantList rows clickable links to `/platform/tenants/[id]`. Created tenant detail Server Component at `app/platform/tenants/[restaurant_id]/page.tsx` using `createAdminClient()` for cross-tenant reads, parallel data fetches, owner email via `auth.admin.getUserById`, tables with QR URLs, menu items with prices, recent orders with item summary. Added E2E test with 5 coverage scenarios including scoping verification.
- 2026-05-18: Code review applied — 9 patches resolved. Added UUID validation guard on `restaurant_id` param. Switched owner profile to `.maybeSingle()` to handle 0-profile case gracefully. Guarded `getUserById` against empty-id call and error/null-data. Hardened `order.items` parsing with `Array.isArray` check + named-item filter. Order summary now shows quantity for items with `qty > 1`. QR URL changed from `break-all` to `break-words`. Added `focus-visible` ring + `focus-within` to TenantList row for keyboard accessibility. E2E table-count assertion scoped to summary `<dl>` (was brittle `getByText('1').first()`). 330/330 unit tests pass; TypeScript clean.
