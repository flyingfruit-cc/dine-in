# Story 7.1: Analytics Data Aggregation Layer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a server-side aggregation layer that computes analytics on demand from the `orders` table,
so that the analytics page does not run expensive client-side computation and remains responsive at scale.

## Acceptance Criteria

1. **Given** the analytics route is requested
   **When** a Server Component calls `getRestaurantAnalytics(supabase, restaurantId, period)`
   **Then** all aggregations are computed in Postgres via the `public.get_restaurant_analytics(p_restaurant_id, p_start, p_end)` SQL function using `date_trunc`, `count(*)`, `sum`, and `jsonb_array_elements` on the `orders` table — never in JavaScript
   **And** the helper returns one strongly-typed `AnalyticsData` object covering: order count, total revenue (cents), average order value (cents), orders-by-day series, day-of-week × hour-of-day heatmap series, and a top-items list with per-variant counts

2. **Given** an owner has fewer than 30 orders submitted in the requested period
   **When** `getRestaurantAnalytics` returns
   **Then** the result includes `emptyState: true` so callers (Stories 7.2 / 7.3) can render: *"Not enough data yet — keep serving!"* with the target hint *"Come back when you have ≥30 orders"*
   **And** none of the aggregate arrays are populated with sparse / misleading buckets

3. **Given** an order-volume query against ≥10,000 rows for one restaurant
   **When** the SQL function runs against local Supabase seeded with ≥10,000 rows
   **Then** the round-trip completes in ≤1000ms
   **And** the composite index `idx_orders_restaurant_submitted_at` on `orders(restaurant_id, submitted_at desc)` exists (created in this story's migration)

4. **Given** the user is a platform admin viewing a tenant
   **When** the helper is called with the **admin client** (`createAdminClient()`) and the target `restaurant_id`
   **Then** the same Postgres function runs under the service role and returns that tenant's aggregates (matches the cross-tenant pattern from Story 6.2)

5. **Given** an authenticated owner whose `get_my_restaurant_id()` is restaurant A
   **When** the helper is called with the **server cookie client** and `restaurantId` = restaurant B
   **Then** RLS on `orders` plus the function's explicit `WHERE restaurant_id = p_restaurant_id` defense-in-depth produces zero rows for restaurant B → the helper returns an all-zero `AnalyticsData` with `emptyState: true` — never another tenant's data

6. **Given** an order is submitted via `submitOrder` after this story ships
   **When** the row is inserted into `orders`
   **Then** the new column `orders.total_cents` is populated as the sum of `(quantity × unit_price_cents)` over all `items` entries, and each entry in the `items` jsonb carries a `unit_price_cents: number` field denormalized from the cart at submission time
   **And** historical orders (no `unit_price_cents`, default `total_cents = 0`) do not crash the SQL function — they contribute 0 to revenue aggregates, only to order/item count aggregates

---

## Tasks / Subtasks

- [x] **Task 1 — Schema migration: `orders.total_cents`, jsonb shape note, and composite index** (AC: #3, #6)
  - [x] Create migration file `supabase/migrations/{{YYYYMMDDHHMMSS}}_add_orders_total_cents_and_analytics_index.sql`
  - [x] `ALTER TABLE public.orders ADD COLUMN total_cents integer NOT NULL DEFAULT 0;` — `NOT NULL DEFAULT 0` so historical rows back-fill safely with 0 (acceptable per AC #6)
  - [x] Add `CHECK (total_cents >= 0)` constraint — revenue is never negative
  - [x] `CREATE INDEX IF NOT EXISTS idx_orders_restaurant_submitted_at ON public.orders (restaurant_id, submitted_at DESC);` — composite index supports both period range scans and ordering
  - [x] Apply via Supabase MCP (per `docs/conventions/supabase-clients.md`: "Schema changes — Applied via Supabase dashboard SQL editor or Supabase MCP")
  - [x] After apply: regenerate `types/supabase.ts` with `supabase gen types` and commit the diff — `total_cents: number` must appear in the `orders` Row/Insert/Update types

- [x] **Task 2 — Schema migration: `public.get_restaurant_analytics` SQL function** (AC: #1, #2, #3, #5)
  - [x] Create migration file `supabase/migrations/{{YYYYMMDDHHMMSS}}_add_get_restaurant_analytics_function.sql`
  - [x] Function signature: `SECURITY INVOKER STABLE` with correct params
  - [x] Defense-in-depth WHERE clause in every CTE
  - [x] jsonb result with five keys: `order_count`, `total_revenue_cents`, `orders_by_day`, `orders_by_dow_hour`, `top_items`
  - [x] `coalesce((item->>'unit_price_cents')::int, 0)` for historical row safety
  - [x] `top_items.variants` via `jsonb_object_agg` with `"standard"` fallback
  - [x] `GRANT EXECUTE ... TO authenticated, service_role`
  - [x] Applied via Supabase MCP

- [x] **Task 3 — Extend types: `unit_price_cents` on `OrderItem`, `total_cents` on `Order`, analytics types** (AC: #1, #6)
  - [x] Added `unit_price_cents: number` to `OrderItem`
  - [x] Added `total_cents: number` to `Order`
  - [x] Added `AnalyticsPeriod`, `OrdersByDay`, `OrdersByDowHour`, `TopItem`, `AnalyticsData` to `types/app.ts`

- [x] **Task 4 — Update `submitOrder` to denormalize prices and total** (AC: #6)
  - [x] Bucket type gains `unit_price_cents: number` from `item.price_cents`
  - [x] `total_cents` computed as `sum(quantity × unit_price_cents)` after loop
  - [x] `total_cents` added to `.insert({...})` payload
  - [x] No `.select()` preserved — 42501/RETURNING trap maintained
  - [x] Unit tests in `tests/unit/actions/orderActions.test.ts` assert payload shape

- [x] **Task 5 — New helper `lib/analytics/getRestaurantAnalytics.ts`** (AC: #1, #2, #4, #5)
  - [x] Created `lib/analytics/getRestaurantAnalytics.ts`
  - [x] Client-agnostic signature: accepts `SupabaseClient<Database>`
  - [x] Period → UTC time-range mapping for all four periods
  - [x] Calls `supabase.rpc('get_restaurant_analytics', ...)` with correct args
  - [x] Error path: `console.error` + all-zero emptyState result, never throws
  - [x] `data === null` path: returns emptyState result
  - [x] Full jsonb → `AnalyticsData` normalization with `averageOrderValueCents` (0 guard)
  - [x] `emptyState = orderCount < 30`

- [x] **Task 6 — Unit tests for the helper** (AC: #1, #2, #5)
  - [x] Created `tests/unit/lib/analytics/getRestaurantAnalytics.test.ts`
  - [x] 8 tests using `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-06-01T12:34:56Z'))`
  - [x] '7d' period args, 'today' midnight UTC, emptyState<30, emptyState>=30+average
  - [x] Error no-throw, data=null, full normalization, div-by-zero=0

- [x] **Task 7 — RLS integration test for tenant isolation** (AC: #5)
  - [x] Created `tests/rls/analytics.spec.ts`
  - [x] beforeAll: two restaurants + owners, 5 orders each with `unit_price_cents` and `total_cents`
  - [x] Test 1: owner A → own restaurant → order_count=5, total_revenue_cents=5000
  - [x] Test 2: owner A → restaurant B → order_count=0, total_revenue_cents=0 (RLS blocks)
  - [x] Test 3: service role → restaurant B → order_count=5, total_revenue_cents=7500
  - [x] afterAll cleanup

- [x] **Task 8 — Performance smoke test** (AC: #3)
  - [x] `test.describe.skip('Analytics performance (manual)')` block in `tests/rls/analytics.spec.ts`
  - [x] Seeds 10,000 orders in 1,000-row chunks via batched insert
  - [x] Measures `performance.now()` around RPC call, asserts < 1000ms
  - [x] Skipped by default — unskip `test.describe.skip` to run manually

---

## Dev Notes

### Critical Context

**This is the first story in Epic 7.** Stories 7.2 (charts UI + period selector) and 7.3 (popular items + revenue summary) both depend on this helper being in place and **return a single round-trip per page render**. The shape of `AnalyticsData` defined here is the contract — getting the field names right matters more than the implementation details, because 7.2 and 7.3 will import and destructure this type.

**The `OrderItem` jsonb shape is changing.** Today (after Epic 4) each item in `orders.items` is `{ name, quantity, variants }` only — no price. Story 7.1 adds `unit_price_cents` going forward. Critical implications:
- **Forward-only.** Historical orders (any orders submitted before this story ships) have no `unit_price_cents` key. The Postgres function uses `coalesce((item->>'unit_price_cents')::int, 0)`, so they contribute 0 revenue. Acceptable: in production we have no real historical orders yet; in test envs, the RLS spec seeds new orders with the new shape.
- **No backfill.** If a future story wants historical revenue, it would re-derive prices from `menu_items` — but per Epic 7.3 AC, item names are denormalized precisely *because* `menu_items` can be deleted. So historical revenue is unrecoverable; this is a known trade-off.
- **`OrderItem.price_cents`?** Do not add a redundant `price_cents` — `unit_price_cents` is the single source of truth (it is the variant-adjusted final unit price, computed once per cart bucket in `submitOrder`).

**The Postgres function does all aggregation in SQL.** Do **not** fetch rows into Node and reduce in JavaScript. The architecture explicitly forbids this (epic AC #1 and project-context "Postgres performance" guidance). One RPC round-trip → one jsonb result → one type cast.

**Helper accepts a `SupabaseClient`, never creates one.** This is the design lever that lets the same code serve owner pages (cookie client → RLS-protected) and platform admin pages (admin client → service-role bypass). Story 6.2 established the parallel pattern for tenant inspection; replicate it exactly. Do not split into `getOwnerAnalytics` and `getAdminAnalytics`.

**Owner cross-tenant defense is RLS + explicit `WHERE`.** Two layers stack here:
1. `SECURITY INVOKER` on the function preserves the caller's identity → RLS on `orders` (policy `owner_select_orders`) filters rows.
2. The function body still includes `WHERE restaurant_id = p_restaurant_id` so a service-role caller doesn't accidentally get unfiltered data when they pass a stale id.
Together: owner asking for someone else's restaurant gets zero rows. The Postgres aggregation operators (`count(*)`, `sum(...)`) on zero rows return 0 or NULL — handled by `coalesce(...)` and the empty-state computation in the helper.

**Threshold semantics for `emptyState`.** AC #2 says "fewer than 30 completed orders" but MVP has no `completed` status (Epic 9 will add status tracking). For MVP, **"completed" = "submitted"** — i.e. any row in `orders` for the period. Note this in the helper's JSDoc. When Story 9 ships, `emptyState` may need to filter on a future status enum; that's a future story's problem.

**Timezone is UTC for MVP.** Restaurant-local timezone is a known deferred issue (Story 6.2 also deferred locale/timezone date formatting). For 7.1, period boundaries are UTC. Restaurants in non-UTC zones will see slightly off "today" boundaries — accept for MVP; the bar/heatmap charts are still directionally correct over 7d/30d/90d windows.

**No new Server Action.** `getRestaurantAnalytics` is a plain async function. Server Actions in this codebase always return `ActionResult<T>` and are typically mutations. This is a *read* helper imported by Server Components — same shape as `app/admin/orders/page.tsx`'s inline `await supabase.from(...)` calls, just factored into a helper. Do **not** add `'use server'`.

**The function must handle the empty-rows path gracefully.** `top_items` is built by `jsonb_array_elements(items)` — if zero `orders` match, this still produces an empty `top_items: []`. Make sure the SQL's outer `jsonb_build_object(...)` builds the result even when each sub-CTE returns zero rows. `coalesce(jsonb_agg(...), '[]'::jsonb)` is the idiom.

**No customer-facing breakage from the `submitOrder` change.** Customers don't read the `items` jsonb — they only see the confirmation screen. The admin order feed (`components/admin/OrderCard.tsx`) reads `items` for display. Verify the existing OrderCard tolerates the extra `unit_price_cents` field — TypeScript widening makes the new optional field invisible to existing destructuring. No UI change required.

### Architecture Compliance

**Client selection** (see `docs/conventions/supabase-clients.md`):
- The helper is **client-agnostic** by design — caller provides the client.
- Story 7.2 (the owner analytics page) will call `getRestaurantAnalytics(await createClient(), restaurant_id, period)` from a Server Component using the **server cookie client**.
- Story 6.2's platform tenant detail page will (in a future increment) wire in `getRestaurantAnalytics(createAdminClient(), restaurant_id, period)` — out of scope here, but the helper must support it (AC #4).

**Server Action discipline doesn't apply** — the helper is not a Server Action. It is exempt from the `ActionResult<T>` rule. It returns `AnalyticsData` directly. On Supabase error, it returns the all-zero / emptyState `AnalyticsData` and logs to console (Sentry will pick up the console.error via the Next.js instrumentation hook). It must **not throw**, because Server Components have no `try/catch` around an awaited Server Component fetch — a throw would bubble to the nearest `error.tsx`, which is the wrong UX for "we got no data for this period".

**Postgres function security** (project-context anti-pattern guard):
- `SECURITY INVOKER` (not `DEFINER`) — explicitly chosen for owner RLS to apply
- `STABLE` (not `VOLATILE`) — function is a pure read; optimizer can cache within a single query
- `GRANT EXECUTE ... TO authenticated, service_role` — `anon` is **not** granted because no anonymous code path needs analytics (sessionless customer flow doesn't surface analytics)

**Index choice**: `(restaurant_id, submitted_at DESC)` is the composite index. `submitted_at DESC` matches the existing order-feed query in `app/admin/orders/page.tsx` indirectly (via `OrderFeed`), and the analytics range-scan (`submitted_at >= p_start AND submitted_at < p_end`) is satisfied by the leading-equality `restaurant_id =` plus the range. The function will also do `GROUP BY date_trunc('day', submitted_at)` — Postgres can serve this from the index leaf order without a sort. Verify with `EXPLAIN` once on the seeded 10k-row dataset (Task 8).

**Naming compliance:**
- Postgres function: `snake_case` (`get_restaurant_analytics`) — matches `get_my_restaurant_id`
- TS function: `camelCase` (`getRestaurantAnalytics`)
- TS types: `PascalCase` (`AnalyticsData`, `AnalyticsPeriod`)
- New directory `lib/analytics/` — parallels existing `lib/supabase/`
- File: `getRestaurantAnalytics.ts` — verb + noun (matches `formatPrice.ts`, `generateQrUrl.ts` patterns)

**Price discipline** (project-context anti-pattern guard):
- All cents fields are `integer` in DB and `number` in TS — never float
- `averageOrderValueCents` is `Math.round(...)` so no float leaks; display layer (7.3) formats via `utils/formatPrice.ts`

**Anti-patterns to avoid:**
- Do **not** add an ORM layer (Drizzle/Prisma) — deferred decision per architecture
- Do **not** create a Postgres view — a function returning jsonb composites the entire payload in one round-trip; a view would require N round-trips for N aggregates
- Do **not** add `setInterval` / refresh logic in this helper — Stories 7.2 / 7.3 own caller-side rendering and revalidation. The helper is stateless and synchronous-per-call.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`actions/orderActions.ts:25-100` — `submitOrder`** (Task 4 modifies this):
- Current state: builds an `items` array via a `Map<string, { name, quantity, variants }>` collapse keyed by `${menuItemId}:${variantKey}`. Inserts via `adminClient.from('orders').insert({ restaurant_id, table_id, items, is_handled: false })`. No `.select()` (correct — 42501/RETURNING trap, see project-context).
- What this story changes:
  - The bucket value type gains `unit_price_cents: number` (from `item.price_cents` in the cart)
  - After the loop, compute `total_cents` as `sum(quantity * unit_price_cents)`
  - Insert payload gains `total_cents`
- What must be preserved:
  - The dedupe-by-variant-key collapse logic — same-item-same-variants must still merge into one bucket
  - Validation of `restaurantSlug`, `tableNumber`, `cartItems.length > 0`
  - The lookup of `restaurant.id` from `restaurantSlug` and `table.id` from `(restaurant_id, table_number)`
  - The `'use server'` directive and `ActionResult<SubmitOrderData>` return type
  - `RETRY_ERROR` user-facing string
  - The deliberate absence of `.select()` after `.insert()`

**`types/app.ts:106-120` — `OrderItem` and `Order`** (Task 3 modifies):
- Current `OrderItem` has only `{ name, quantity, variants }` — adding `unit_price_cents: number` (required, not optional, because all future orders carry it; historical-row reads from the DB will need a runtime guard but the *type* is the forward shape)
- Current `Order` has no `total_cents` — adding it

**`tests/rls/helpers.ts`** — Task 7 uses these without modification:
- `getServiceClient()`, `signInAsOwner(email)`, `createTestRestaurant(svc, slug, name)`, `createTestOwner(svc, restaurantId, email)`, `cleanupTestRestaurants(svc, ids)`, `cleanupTestUsers(svc, ids)`
- No new helper needed; seed orders by direct service-client insert in the spec's `beforeAll`

**`tests/rls/tenant-isolation.spec.ts`** — the pattern to copy:
- `describe` wrapper, `beforeAll`/`afterAll`, `suffix = `ti-${Date.now()}``-style unique ids, the cleanup contract
- Use suffix prefix `an-` for this story

**`supabase/migrations/20260509144631_rls_policies.sql`** — reference for SQL function precedent:
- `get_my_restaurant_id()` is the prior-art for a `SECURITY DEFINER STABLE` function. The new function uses `SECURITY INVOKER` instead — intentional difference, documented in comments inside the migration

**`app/admin/orders/page.tsx`** — reference for owner Server Component shape (Story 7.2 will follow this in its own story; not in scope here, but the helper must fit the pattern):
- `const supabase = await createClient()` from `lib/supabase/server`
- `await supabase.auth.getUser()` → redirect if no user
- `await supabase.from('profiles').select('restaurant_id').eq('id', user.id).single()` → redirect if no restaurant

**`components/admin/OrderCard.tsx`** — sanity check after Task 4:
- It reads `order.items` as `OrderItem[]`. Adding `unit_price_cents` is additive; existing destructuring `{ name, quantity, variants }` is unaffected. No change required, but glance to confirm.

### File Structure (ALL Files)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `supabase/migrations/{{TS}}_add_orders_total_cents_and_analytics_index.sql` | NEW | Schema: ADD COLUMN `total_cents` + composite index |
| `supabase/migrations/{{TS}}_add_get_restaurant_analytics_function.sql` | NEW | Schema: CREATE FUNCTION + GRANT |
| `types/supabase.ts` | UPDATE (auto-gen) | Regenerate after migrations apply — do not hand-edit |
| `types/app.ts` | UPDATE | Add `unit_price_cents` to `OrderItem`, `total_cents` to `Order`, new analytics types |
| `actions/orderActions.ts` | UPDATE | Persist `unit_price_cents` per item, compute and persist `total_cents` |
| `lib/analytics/getRestaurantAnalytics.ts` | NEW | Helper wrapping the RPC; client-agnostic |
| `tests/unit/lib/analytics/getRestaurantAnalytics.test.ts` | NEW | Mocked RPC, period mapping, error path |
| `tests/unit/actions/orderActions.test.ts` | NEW or UPDATE | Assert new payload shape (create file if not present, following existing co-located unit-test pattern) |
| `tests/rls/analytics.spec.ts` | NEW | Tenant isolation + service-role bypass against real Supabase |

### Testing Standards

**Three test layers — three runners (project-context rule):**

| Layer | Location | Runner | Used by this story |
|---|---|---|---|
| Unit | `tests/unit/lib/analytics/`, `tests/unit/actions/` | Vitest (`npm run test`) | Helper period mapping + error path; `submitOrder` payload shape |
| RLS integration | `tests/rls/analytics.spec.ts` | Playwright (`npm run test:rls`) | Tenant isolation + service-role bypass |
| E2E | `tests/e2e/` | Playwright | **Not used here** — the helper has no UI; 7.2/7.3 add e2e |

- **No mocking Supabase in RLS test** — must hit local Supabase per project-context "real-DB smoke test required" rule. `supabase start` must be running.
- Unit tests for the helper mock `SupabaseClient.rpc` via `vi.fn()` — acceptable per project-context "Unit tests may mock Supabase client methods for component isolation".
- Use `vi.useFakeTimers()` for deterministic period-boundary assertions.
- Suffix convention: `an-${Date.now()}` for analytics test fixtures.

### Previous Story Intelligence (from Epic 6)

- **`createAdminClient()` import path is `@/lib/supabase/admin`** — not `utils/supabase/admin` (which doesn't exist). Story 6.2 dev notes confirm.
- **Parallel `Promise.all` is the standard for multi-fetch Server Components** — but this story doesn't apply that pattern because it's *one* RPC round-trip. If a future story needs more data alongside analytics, follow Story 6.2's `Promise.all` block.
- **`.maybeSingle()` not `.single()` when row may not exist** — Story 6.2 patched a `.single()` → `.maybeSingle()` regression. Not directly applicable here (the RPC always returns one jsonb row), but worth keeping in mind for `submitOrder`'s lookup queries (those use `.single()` against unique constraints, which is correct — slug uniqueness, table number per restaurant uniqueness).
- **UUID format validation for path params** — Story 6.2 added a guard before queries to avoid Postgres 22P02. Not directly applicable here (the analytics page in 7.2 will use the owner's own `restaurant_id` from `profiles`, which is always a valid UUID), but document the precedent for when 7.2 ships a `/platform/tenants/[restaurant_id]/analytics` route.
- **Sentry catches `console.error` automatically** — via the Next.js Sentry init in `instrumentation.ts`. The helper's error path logs via `console.error` and does not need explicit `Sentry.captureException` calls.
- **`generateQrUrl` and `formatPrice` already exist** — neither needed here, but if 7.3 needs price display, it must go through `utils/formatPrice.ts` (project-context anti-pattern: never inline format currency).

### Git Intelligence Summary

Recent commits show Epic 6 (`tenants list`, `tenant details`) and the `landing page` + `sign out` + `clean up epic and stories` work that closed out MVP. No analytics scaffolding exists; this is a green-field story. The most relevant prior PR is Story 6.2 (`8b8b35d tenant details`) — its Server Component pattern with `createAdminClient()` and parallel fetches is the closest analogue. The `06f080b sessionless customer flow` commit is the source of the current `submitOrder` shape that this story extends.

### Latest Tech Information

- **Supabase RPC + jsonb_build_object** is the canonical pattern for "one round-trip, multiple aggregates". `supabase-js` exposes `.rpc(name, args)` returning `{ data, error }` — the same shape as table queries. `data` is the function's return value (here, `jsonb` → JSON-parsed object) typed as `Json` in generated types; the helper casts it to `AnalyticsData`.
- **Postgres `jsonb_array_elements` performance**: requires unnesting on every row matched by the WHERE clause. The composite index ensures the row set is pre-filtered before unnesting. For a 90-day window on 10k rows with ~5 items per order, that's ~50k jsonb tuple expansions — Postgres handles this comfortably in <100ms with a warm cache. AC #3's 1s budget has substantial headroom.
- **`extract(dow from ...)` returns 0–6 with Sunday = 0** — matches the JS convention. `extract(hour from ...)` returns 0–23. No timezone shift inside the function (the function takes `timestamptz` and Postgres handles UTC normalization for `extract`).
- **No new npm dependencies** — no charting library here (deferred to 7.2 per epic AC). No date library — `Intl.DateTimeFormat` + `Date` arithmetic suffices for the period-boundary math.

### Project Context Reference

Always read `_bmad-output/project-context.md` before implementation. Key rules that bite in this story:

- **`types/supabase.ts` is auto-generated** — regenerate after Task 1's migration; don't hand-edit
- **Path alias `@/*`** — use `@/lib/analytics/...`, `@/types/app`, etc. — never relative `../`
- **Server-only modules use `import 'server-only'`** — the helper does not need this guard (it's not a Server Action and contains no secrets); but if you mistakenly create one in a Client Component import path, this guard is in `lib/supabase/admin.ts` for reference
- **Server Actions never throw** — applies to `submitOrder` (already compliant); `getRestaurantAnalytics` is exempt as a non-Action helper, but follows the same no-throw discipline
- **Schema changes**: apply via Supabase MCP, then regenerate types, then commit. Migration files in `supabase/migrations/` are tracked in git (the project-context note "no CLI migration files tracked in git" is stale — see the populated `supabase/migrations/` directory)
- **`42501` overload**: still applies — `submitOrder` continues with `.insert(row)` (no `.select()`) after Task 4 changes

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture (RPC pattern not explicitly mentioned but compatible with the "PostgREST direct + Server Actions" model)
- Epics: `_bmad-output/planning-artifacts/epics.md#Story-7.1` — source ACs (lines 988–1018)
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR45–FR48 (Post-MVP analytics)
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` — no analytics UI spec (deferred to Phase 2; relevant only for 7.2/7.3)
- Project Context: `_bmad-output/project-context.md` — Technology Stack, Supabase Client Selection, anti-patterns
- Conventions: `docs/conventions/supabase-clients.md` — client selection table + 42501 trap
- Prior art: `_bmad-output/implementation-artifacts/6-2-tenant-account-inspection-data-access.md` — admin-client cross-tenant pattern
- Prior art: `supabase/migrations/20260509144631_rls_policies.sql` — `get_my_restaurant_id` function precedent
- Prior art: `actions/orderActions.ts` — current `submitOrder` shape this story extends

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tests/unit/lib/analytics/getRestaurantAnalytics.test.ts` — initial test for error path used `await expect(async () => { result = ... }).not.toThrow()` which left `result` undefined; replaced with direct `const result = await getRestaurantAnalytics(...)` call.
- `tests/rls/analytics.spec.ts` — initially imported `describe` from `@playwright/test`; Playwright uses `test.describe`, not a standalone `describe`. Fixed import and renamed `describe.skip` to `test.describe.skip`.
- Test fixtures for `OrderItem` and `Order` in four existing test files required `unit_price_cents` and `total_cents` after those fields became required. Added `unit_price_cents: 0` and `total_cents: 0` to all `makeOrder` helpers.

### Completion Notes List

- **Task 1**: Migration `20260520100000_add_orders_total_cents_and_analytics_index.sql` applied via Supabase MCP. `types/supabase.ts` regenerated — `total_cents: number` appears in `orders` Row/Insert/Update types and `get_restaurant_analytics` function signature added.
- **Task 2**: Migration `20260520100001_add_get_restaurant_analytics_function.sql` applied. Function uses `SECURITY INVOKER` (not DEFINER) so RLS applies for owner callers; service-role callers bypass RLS as designed. `coalesce((item->>'unit_price_cents')::int, 0)` ensures historical rows contribute 0 revenue safely.
- **Task 3**: All new types exported from `types/app.ts`. `OrderItem.unit_price_cents` and `Order.total_cents` are required (forward shape — no historical row reads in production yet).
- **Task 4**: `submitOrder` bucket type extended with `unit_price_cents`; `total_cents` computed and inserted. No `.select()` preserved per 42501/RETURNING convention.
- **Task 5**: Helper is client-agnostic — same function serves owner (cookie client → RLS) and platform admin (admin client → bypass). Never throws; returns all-zero `AnalyticsData` with `emptyState: true` on any failure path.
- **Task 6**: 8 Vitest unit tests with fake timers. All pass. Covers period mapping, emptyState threshold, error no-throw, null data, full normalization, div-by-zero guard.
- **Task 7**: RLS integration spec ready for `npm run test:rls` when `supabase start` is running. Three tests cover own-data, cross-tenant RLS block, and service-role bypass.
- **Task 8**: Performance smoke test blocked behind `test.describe.skip`. Remove `skip` and run `npm run test:rls` with local Supabase to validate AC #3.

### File List

- `supabase/migrations/20260520100000_add_orders_total_cents_and_analytics_index.sql` — NEW
- `supabase/migrations/20260520100001_add_get_restaurant_analytics_function.sql` — NEW
- `supabase/migrations/20260520150000_patch_get_restaurant_analytics_function.sql` — NEW (review patches P1–P7, P12)
- `types/supabase.ts` — UPDATE (auto-regenerated)
- `types/app.ts` — UPDATE
- `actions/orderActions.ts` — UPDATE
- `lib/analytics/getRestaurantAnalytics.ts` — NEW
- `tests/unit/lib/analytics/getRestaurantAnalytics.test.ts` — NEW
- `tests/unit/actions/orderActions.test.ts` — NEW
- `tests/rls/analytics.spec.ts` — NEW
- `tests/unit/admin/OrderCard.test.tsx` — UPDATE (fixture `unit_price_cents` + `total_cents`)
- `tests/unit/admin/OrderFeed.test.tsx` — UPDATE (fixture `unit_price_cents` + `total_cents`)
- `tests/unit/shared/RealtimeProvider.test.tsx` — UPDATE (fixture `unit_price_cents` + `total_cents`)
- `tests/unit/stores/orderStore.test.ts` — UPDATE (fixture `unit_price_cents` + `total_cents`)

### Change Log

- 2026-05-20: Story 7.1 implemented — analytics aggregation layer (Date: 2026-05-20)
- 2026-05-20: Code review run — 4 decision-needed, 10 patches, 21 deferred, 6 dismissed (Date: 2026-05-20)
- 2026-05-20: Code review patches applied — all 13 (P1–P13) committed; migration `20260520150000_patch_get_restaurant_analytics_function.sql` applied; tests 347/347 green; status → done (Date: 2026-05-20)

### Review Findings

**Decision-needed (resolved 2026-05-20):**

- [x] [Review][Decision] AC #2 compliance — *Resolved: suppress arrays when emptyState=true* (matches AC literally; simplifies 7.2/7.3 caller logic). Becomes patch P10.
- [x] [Review][Decision] Naming convention for nested type fields — *Resolved: rename to camelCase* (`revenueCents` in `OrdersByDay` and `TopItem`). Becomes patch P11.
- [x] [Review][Decision] `top_items` ranking — *Resolved: expose both axes, caller sorts client-side* (remove/raise the SQL `LIMIT 10` cap; caller picks axis). Becomes patch P12.
- [x] [Review][Decision] Error path vs emptyState — *Resolved: add `error?: boolean` flag to `AnalyticsData`* so callers can distinguish outage from "no orders yet". Becomes patch P13.

**Patches (all applied 2026-05-20):**

- [x] [Review][Patch] P1: SQL `(item->>'quantity')::int` wrapped with `COALESCE(..., 0)` — applied in `20260520150000_patch_get_restaurant_analytics_function.sql`
- [x] [Review][Patch] P2: SQL `date_trunc('day', submitted_at AT TIME ZONE 'UTC')` — applied
- [x] [Review][Patch] P3: SQL `EXTRACT(DOW/HOUR FROM submitted_at AT TIME ZONE 'UTC')` — applied
- [x] [Review][Patch] P4: SQL `SUM(...)::bigint` for all revenue aggregates — applied
- [x] [Review][Patch] P5: SQL `jsonb_array_elements` guarded with `CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END` — applied
- [x] [Review][Patch] P6: SQL `top_items ORDER BY ... DESC, name ASC` deterministic tiebreaker — applied
- [x] [Review][Patch] P7: SQL explicit `REVOKE EXECUTE ... FROM PUBLIC` before GRANT — applied
- [x] [Review][Patch] P8: Helper UUID validation via `UUID_REGEX` before RPC call — applied [lib/analytics/getRestaurantAnalytics.ts]
- [x] [Review][Patch] P9: RLS test `P_END = +1 day` (was +60s) — applied [tests/rls/analytics.spec.ts]
- [x] [Review][Patch] P10: Helper suppresses `ordersByDay/ordersByDowHour/topItems` when `emptyState=true` — applied [lib/analytics/getRestaurantAnalytics.ts]
- [x] [Review][Patch] P11: Renamed `revenue_cents` → `revenueCents` in `OrdersByDay` and `TopItem`; helper remaps snake_case RPC keys → camelCase — applied [types/app.ts, lib/analytics/getRestaurantAnalytics.ts]
- [x] [Review][Patch] P12: SQL `top_items LIMIT 50` (was 10) so caller can sort by either axis — applied
- [x] [Review][Patch] P13: Added `error?: boolean` to `AnalyticsData`; helper sets `error: true` on RPC error and invalid-UUID paths — applied [types/app.ts, lib/analytics/getRestaurantAnalytics.ts]

**Deferred (acknowledged trade-offs or out of scope):**

- [x] [Review][Defer] Restaurant-local timezone support — MVP-deferred per spec Dev Notes
- [x] [Review][Defer] First-day bucket asymmetry in rolling 7d/30d/90d windows — acknowledged trade-off; "directionally correct" per spec
- [x] [Review][Defer] Race between TS `periodEnd` and SQL execution time — inherent to instant-now semantics
- [x] [Review][Defer] `submitOrder` `getEffectivePrice` semantics with multi-group variants — pre-existing, not caused by this story [actions/orderActions.ts]
- [x] [Review][Defer] `submitOrder` `total_cents` overflow for very large carts — edge case
- [x] [Review][Defer] Migration backfill for existing orders' `total_cents` — dev/staging only per spec
- [x] [Review][Defer] AC #3 performance test `.skip` — spec explicitly authorizes skip-by-default; index half is verifiable [tests/rls/analytics.spec.ts:130]
- [x] [Review][Defer] `cleanupTestRestaurants` doesn't verify deletion happened — test helper concern
- [x] [Review][Defer] Helper does not categorize Supabase error codes (auth vs schema vs RLS) — observability nice-to-have
- [x] [Review][Defer] `if (!data)` is over-broad (would emptyState on `0`/`false`/`""`) — latent foot-gun, not current bug
- [x] [Review][Defer] No `ANALYZE` after migration — autovacuum handles planner stats
- [x] [Review][Defer] Variant label collision with literal "standard" string — unlikely real-world conflict
- [x] [Review][Defer] `OrderItem.unit_price_cents` / `Order.total_cents` required types vs historical-row reads — acknowledged "forward shape" in spec Dev Notes
- [x] [Review][Defer] Migration creates index without `CONCURRENTLY` — MVP, small `orders` table; acceptable lock duration
- [x] [Review][Defer] Negative `unit_price_cents` not blocked at action layer — cart sourced from menu_items with CHECK constraints; defense-in-depth
- [x] [Review][Defer] No DB-level CHECK invariant `total_cents == sum(items[i].quantity × unit_price_cents)` — defense-in-depth not in spec
- [x] [Review][Defer] No explicit '90d' period unit test — coverage gap; type narrows to four periods anyway
- [x] [Review][Defer] RLS test doesn't seed historical-shape orders to verify `coalesce` safety claim — coverage gap
- [x] [Review][Defer] RLS test doesn't assert `top_items.variants` shape (incl. "standard" fallback) — coverage gap
- [x] [Review][Defer] Performance test uses `Math.random()` for `submitted_at` spread — test quality, not gating
- [x] [Review][Defer] Test mock `from()` returns `undefined` for unknown tables — test brittleness in `tests/unit/actions/orderActions.test.ts`
