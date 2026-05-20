# Story 9.1: Order Status Data Model & Server Action

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want orders to carry a status enum with server-side advancement rules,
so that the customer-facing status workflow has a single source of truth and UPDATE events propagate live to both owner and customer surfaces.

## Acceptance Criteria

1. **Given** the schema migration is applied
   **When** `public.orders` is inspected
   **Then** a `status` column exists of type `order_status` enum with values `received` (default), `preparing`, `ready`, `completed`
   **And** existing rows are backfilled: `is_handled = true` → `'completed'`, otherwise `'received'`
   **And** `is_handled` and `handled_at` columns are **preserved** unchanged — `completed` is the new terminal state but the Admin UI feed continues to read `is_handled` until Story 9.2 migrates the feed

2. **Given** an authenticated owner calls `advanceOrderStatus(orderId, nextStatus)` from `actions/orderActions.ts`
   **When** the server-side transition validator runs
   **Then** only one-step-forward transitions are accepted: `received → preparing`, `preparing → ready`, `ready → completed`
   **And** any other transition (same-status, skip-ahead, backward) returns `{ success: false, error: 'Invalid status transition' }` with **no DB write**
   **And** the DB UPDATE uses the owner cookie client (RLS path), filters by `id = orderId AND status = currentStatus` for optimistic concurrency, and does **not** chain `.select()` (42501/RETURNING guard)
   **And** when `nextStatus = 'completed'`, the same UPDATE also sets `is_handled = true` and `handled_at = now()` (atomic — single UPDATE, not two round-trips) so the Admin UI's Handled tab keeps working

3. **Given** the customer-side Realtime path for Story 9.3
   **When** a new RLS policy `customer_select_order_by_id` is created on `public.orders` for role `anon`
   **Then** anon SELECTs on `orders` are permitted (the (slug, table_number, order_id) tuple validation lives server-side in the admin-client SSR fetch — see Dev Notes "Customer auth model")
   **And** the existing `owner_select_orders` and `owner_update_orders` policies remain unchanged
   **And** `public.orders` is **already** in the `supabase_realtime` publication (Story 5.1 migration) and the `RealtimeProvider` already subscribes to both INSERT and UPDATE events — no Realtime/publication changes are required in this story

4. **Given** the migration is complete
   **When** `tests/rls/order-status.spec.ts` runs
   **Then** an owner can advance their own order's status; cross-tenant attempts return 0 affected rows (RLS denies)
   **And** invalid transitions (e.g. `received → ready`) return `{ success: false, error: 'Invalid status transition' }` and the DB row is unchanged
   **And** anon-role SELECTs on `orders` succeed for any UUID (validates the new `customer_select_order_by_id` policy is in place)
   **And** the backfill is correct: a row inserted with `is_handled=true` before the migration shows `status='completed'`; a row with `is_handled=false` shows `status='received'`

5. **Given** a unit test file `tests/unit/actions/orderActions.test.ts`
   **When** new tests are added for `advanceOrderStatus`
   **Then** they cover: each valid one-step transition writes the new status; each invalid transition returns `{ success: false, error: 'Invalid status transition' }` without invoking `.update()`; the `completed` transition includes `is_handled=true` and `handled_at` in the UPDATE payload; the action returns `{ success: false, error: 'Not authenticated' }` when there is no session

---

## Tasks / Subtasks

- [x] **Task 1 — Write & apply the schema migration** (AC: #1, #3)
  - [x] Create a new file `supabase/migrations/{YYYYMMDDHHMMSS}_add_order_status_enum.sql` with timestamp ≥ `20260520150000` (latest existing). Use the same hand-written, narrated pattern as `20260520100000_add_orders_total_cents_and_analytics_index.sql`.
  - [x] Migration contents (in this order — order matters because the backfill must run before the NOT NULL constraint):
    ```sql
    -- Story 9.1: Order status enum + customer-side anon SELECT policy.
    -- is_handled / handled_at are preserved; Story 9.2 will migrate the Admin UI feed off them.

    CREATE TYPE public.order_status AS ENUM (
      'received',
      'preparing',
      'ready',
      'completed'
    );

    ALTER TABLE public.orders
      ADD COLUMN status public.order_status;

    UPDATE public.orders
      SET status = CASE WHEN is_handled THEN 'completed'::public.order_status
                        ELSE 'received'::public.order_status
                   END;

    ALTER TABLE public.orders
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN status SET DEFAULT 'received'::public.order_status;

    -- Customer-side Realtime / SSR-fetch path: anon role may SELECT orders.
    -- The (restaurant_slug, table_number, order_id) tuple is validated server-side
    -- in the admin-client SSR fetch (Story 9.3) before the order_id ever reaches
    -- the client. Knowing the UUID is the implicit auth factor.
    CREATE POLICY "customer_select_order_by_id" ON public.orders
      FOR SELECT TO anon
      USING (true);
    ```
  - [x] **DO NOT** drop, rename, or alter `is_handled` / `handled_at` — Story 9.2's Admin UI work depends on them remaining until 9.2 lands (AC #1).
  - [x] **DO NOT** add a CHECK constraint that enforces transitions in SQL — transition rules live in the Server Action (per project-context: server-side validation in `'use server'` actions). A SQL trigger here would silently fail the e2e test and double-enforce.
  - [x] **DO NOT** include the migration's `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders` — already added by `20260518210000_add_orders_to_realtime_publication.sql`; re-adding raises an error (idempotency guard would mask it but it's pointless work).
  - [x] Apply the migration via the Supabase MCP `mcp__supabase__apply_migration` tool (per project-context: "Applied via Supabase dashboard SQL editor or Supabase MCP"). Use migration `name`: `add_order_status_enum`.
  - [x] After applying, regenerate types: run `npx supabase gen types typescript --local --schema public > types/supabase.ts` (or the project's equivalent — check the existing types file header for the command). Commit the regenerated `types/supabase.ts`. **DO NOT** edit `types/supabase.ts` by hand (project-context rule).
  - [x] Verify with `mcp__supabase__list_tables` that the `orders` table now reports the `status` column with the correct enum and default. Verify with `mcp__supabase__execute_sql` (`SELECT status, is_handled, count(*) FROM public.orders GROUP BY 1,2`) that the backfill is correct (the `is_handled=true` bucket must show `status='completed'`).

- [x] **Task 2 — Add `OrderStatus` type and update `Order` interface** (AC: #2)
  - [x] Edit `types/app.ts`:
    - Insert a new exported type alias **above** the `Order` interface (around line 113):
      ```ts
      export type OrderStatus = 'received' | 'preparing' | 'ready' | 'completed'
      ```
    - Add `status: OrderStatus` to the `Order` interface (insert after `is_handled: boolean` for visual grouping with the workflow fields):
      ```ts
      export interface Order {
        id: string
        restaurant_id: string
        table_id: string
        items: OrderItem[]
        submitted_at: string
        status: OrderStatus
        is_handled: boolean
        handled_at: string | null
        total_cents: number
      }
      ```
  - [x] **DO NOT** add `status` to a new file — `types/app.ts` is the single home for hand-authored domain types (project-context rule).
  - [x] **DO NOT** rename or remove `is_handled` from the `Order` interface — still in use by `OrderFeed`, `OrderCard`, `KdsScreen`, `orderStore`, and the platform tenants page (AC #1 / project structure).

- [x] **Task 3 — Add `advanceOrderStatus` Server Action** (AC: #2, #5)
  - [x] Edit `actions/orderActions.ts`:
    - Add the import for the new type at the top:
      ```ts
      import type { ActionResult, CartItem, OrderStatus } from '@/types/app'
      ```
    - Add a module-level transition map (above `submitOrder` or grouped with the other actions):
      ```ts
      const VALID_NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
        received: 'preparing',
        preparing: 'ready',
        ready: 'completed',
        completed: null,
      }
      ```
    - Add the new action as a sibling of `markOrderHandled` and `unbumpOrder`:
      ```ts
      export async function advanceOrderStatus(
        orderId: string,
        nextStatus: OrderStatus,
      ): Promise<ActionResult<void>> {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        // Read the current status under RLS — owner_select_orders gates by restaurant_id.
        const { data: current, error: readError } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single()
        if (readError || !current) {
          return { success: false, error: 'Invalid status transition' }
        }

        const currentStatus = current.status as OrderStatus
        if (VALID_NEXT_STATUS[currentStatus] !== nextStatus) {
          return { success: false, error: 'Invalid status transition' }
        }

        // Optimistic-concurrency filter: status must still match what we read,
        // otherwise a concurrent Realtime echo could let two advances stack.
        // No .select() after .update() — 42501/RETURNING guard (project-context anti-pattern table).
        const payload: { status: OrderStatus; is_handled?: boolean; handled_at?: string } = {
          status: nextStatus,
        }
        if (nextStatus === 'completed') {
          payload.is_handled = true
          payload.handled_at = new Date().toISOString()
        }

        const { error } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', orderId)
          .eq('status', currentStatus)

        if (error) {
          console.error('[advanceOrderStatus]', error)
          return { success: false, error: 'Invalid status transition' }
        }
        return { success: true, data: undefined }
      }
      ```
  - [x] **DO NOT** use the admin client. Owner cookie client + RLS `owner_update_orders` is the correct path (matches `markOrderHandled` / `unbumpOrder` exactly).
  - [x] **DO NOT** chain `.select().single()` after `.update()` — would trip the 42501/RETURNING trap documented in project-context "anti-patterns" and in `memory/project_postgres_42501_returning.md`. Caller (Story 9.2 OrderCard) will update the local store optimistically; the Realtime UPDATE echo reconciles the server-side `handled_at`.
  - [x] **DO NOT** rewrite or deprecate `markOrderHandled` / `unbumpOrder` — Story 9.2 explicitly handles the deprecation. Touching them now will require coordinated changes to `KdsScreen`, `OrderFeed`, and their tests, which is out of scope and would expand the diff.
  - [x] **DO NOT** update `submitOrder` to set `status: 'received'` in the insert payload — the column default (set in Task 1's migration) handles it. Adding it would couple this story to the customer flow unnecessarily and require updating the unit test mocks.

- [x] **Task 4 — Unit tests for `advanceOrderStatus`** (AC: #5)
  - [x] Edit `tests/unit/actions/orderActions.test.ts`:
    - Add a new `vi.mock` for `@/lib/supabase/server` already exists; reuse it. Add an import for the action:
      ```ts
      import { advanceOrderStatus } from '@/actions/orderActions'
      import { createClient } from '@/lib/supabase/server'
      ```
    - Add a builder mirroring the file's existing `makeAdminClient` pattern:
      ```ts
      function makeOwnerClient(opts: {
        userId?: string | null
        currentStatus?: 'received' | 'preparing' | 'ready' | 'completed' | null
        readError?: unknown
        updateError?: unknown
      } = {}) {
        const { userId = 'owner-1', currentStatus = 'received', readError = null, updateError = null } = opts

        const selectChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: currentStatus === null ? null : { status: currentStatus },
            error: readError,
          }),
        }
        const updateChain = {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        }
        // The .update().eq().eq() chain resolves on the second .eq()
        const updateEqSecond = vi.fn().mockResolvedValue({ error: updateError })
        updateChain.eq = vi.fn()
          .mockReturnValueOnce({ eq: updateEqSecond })

        const _updatePayloads: unknown[] = []
        const fromMock = vi.fn().mockImplementation((table: string) => {
          if (table !== 'orders') throw new Error('unexpected table: ' + table)
          return {
            select: selectChain.select,
            eq: selectChain.eq,
            single: selectChain.single,
            update: vi.fn((p: unknown) => {
              _updatePayloads.push(p)
              return updateChain
            }),
          }
        })

        return {
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }) },
          from: fromMock,
          _updatePayloads,
          _updateEqSecond: updateEqSecond,
        }
      }
      ```
      **Note**: this is a sketch — adapt to whatever mock shape Vitest accepts in practice. The point is: stub `auth.getUser`, the `.select().eq().single()` chain for the current-status read, and the `.update().eq().eq()` chain for the write, while capturing the update payload for assertion.
    - **Required tests** (each in its own `it(...)`):
      - `'received → preparing succeeds and writes status="preparing" only'`: assert `result.success === true` and the captured update payload is `{ status: 'preparing' }` (no `is_handled`, no `handled_at`).
      - `'preparing → ready succeeds and writes status="ready" only'`.
      - `'ready → completed writes status, is_handled=true, handled_at as ISO string in a single update'`: assert the payload contains all three keys and `handled_at` matches `/^\d{4}-\d{2}-\d{2}T/`.
      - `'received → ready returns { success: false, error: "Invalid status transition" } and does NOT call .update()'`: assert `from('orders').update` was never invoked.
      - `'preparing → preparing (same-status) returns invalid transition and does NOT call .update()'`.
      - `'completed → anything returns invalid transition'` (terminal-state check).
      - `'no session returns { success: false, error: "Not authenticated" } and does NOT read status'`: pass `userId: null`; assert `from` was never called.
      - `'DB error on the UPDATE returns { success: false, error: "Invalid status transition" }'`: pass `updateError: { code: 'XX000', message: 'boom' }`.
      - `'DB error on the status read returns invalid transition'`: pass `readError: { ... }`.
  - [x] **DO NOT** mock `console.error` away — the existing tests don't, and the action logs on error. Use `vi.spyOn(console, 'error').mockImplementation(() => {})` in a `beforeEach` only if the noise is a problem.
  - [x] **DO NOT** test the RLS denial in the unit test — that belongs in Task 5 (`tests/rls/order-status.spec.ts`) which uses the real DB. Unit tests can't see RLS.
  - [x] **DO NOT** modify the existing `submitOrder` tests — they still pass because Task 3 does not change `submitOrder`.

- [x] **Task 5 — RLS integration test** (AC: #4)
  - [x] Create `tests/rls/order-status.spec.ts` following the structure of `tests/rls/tenant-isolation.spec.ts` (look at it for the test/fixture layout — `getServiceClient`, `createTestRestaurant`, `createTestOwner`, `signInAsOwner`, `createTestTable`, `createTestOrder`, `cleanupTestRestaurants` from `tests/rls/helpers.ts`).
  - [x] **Required tests**:
    1. `'backfill: pre-existing is_handled=true rows show status=completed; is_handled=false rows show status=received'`
       - Use `getServiceClient()`. Create a restaurant, table, and two orders via `createTestOrder` (one with `is_handled=true` patched via service client UPDATE after insert, one default `is_handled=false`).
       - Service-client SELECT both rows; assert `status` matches the expected value. *(This validates the migration's UPDATE statement; cleanup may have already run on the project so seed deterministically inside the test.)*
    2. `'owner can advance their own order: received → preparing → ready → completed via advanceOrderStatus'`
       - Sign in as owner via `signInAsOwner`. Import `advanceOrderStatus` is NOT possible in a Playwright spec (Server Actions can't be called directly); instead, exercise the **action's contract** by calling the equivalent `.from('orders').update({ status: 'preparing' }).eq('id', orderId).eq('status', 'received')` chain with the **signed-in owner client**. Verify the UPDATE returns no error and a follow-up SELECT shows the new status.
       - Repeat for each step of the workflow. At `completed`, also verify `is_handled` and `handled_at` updated atomically (use a single UPDATE in the test that sets all three; this models what the Server Action does).
    3. `'cross-tenant owner cannot update another restaurant's order — 0 rows affected, status unchanged'`
       - Create two restaurants with two owners and one order in restaurant A. Sign in as owner B and attempt to UPDATE order A's status. Use the `.select()` count (or follow-up SELECT) to confirm 0 rows were affected and the status is unchanged. Owner B's SELECT on order A returns 0 rows (RLS).
    4. `'anon role can SELECT an order by id'`
       - Use `getAnonClient()`. SELECT `status` from `orders` filtered by `id = {order_id}`. Expect 1 row returned. This validates `customer_select_order_by_id`.
    5. `'anon role can SELECT any order by id even from another restaurant — server-side tuple validation owns the security boundary'`
       - This is an **assertion** that the RLS is permissive by design. Document this with a comment in the test referencing Dev Notes "Customer auth model". The intent is to make the design choice explicit and to fail loudly if a future migration tightens this policy without updating Story 9.3's SSR validation.
  - [x] Track all created `restaurant_id`s and `user_id`s in a `try/finally` and call `cleanupTestRestaurants` + `cleanupTestUsers` in `afterAll` (per memory `feedback_real_db_smoke_test.md` and the helpers' contract).
  - [x] **DO NOT** mock Supabase in this spec — per project-context "Mock discipline" and memory `feedback_real_db_smoke_test.md`, RLS tests must hit a real DB. Run with `npm run test:rls` against local Supabase (`supabase start`).
  - [x] **DO NOT** assert error messages from Postgres directly (they vary across versions) — assert row counts or the post-state of the row.

- [ ] **Task 6 — Manual smoke test against a real DB** (AC: #1, #2)
  - [ ] Start local Supabase: `supabase start`. Run `npm run dev`.
  - [ ] Sign in as the test owner. From the SQL editor (`supabase db psql` or the dashboard), `INSERT` a test order with `is_handled=false`. Confirm via `SELECT status FROM orders` that it shows `received`.
  - [ ] Open the browser devtools network tab on `/admin/orders`. Manually invoke the Server Action from a one-off page (or temporarily wire a button in a dev-only route) calling `advanceOrderStatus(orderId, 'preparing')`. Confirm:  <!-- manual user step -->
    - The DB row's `status` is now `preparing`.
    - The Admin UI feed is unaffected (the OrderCard still shows the Active state because `is_handled=false`).
    - A second call with `nextStatus='completed'` (skipping `ready`) returns `{ success: false, error: 'Invalid status transition' }` and the row is unchanged.
  - [ ] **Then** call `advanceOrderStatus(orderId, 'ready')` then `'completed'`. After the `completed` call: confirm the row shows `status='completed'`, `is_handled=true`, `handled_at IS NOT NULL`. The OrderFeed's Handled tab now lists the order.
  - [ ] (Left for manual verification by user — required by memory `feedback_real_db_smoke_test.md` for customer-facing Server Actions with RLS. `advanceOrderStatus` is owner-facing, but the same discipline applies because RLS gates it.)

### Review Findings

_From code-review run on 2026-05-20 (blind+edge+auditor)._

**Decisions resolved** (2026-05-20):

- [x] [Review][Decision] Anon SELECT policy column scope → **resolved: expose via view** (`orders_customer_status` exposing `id, status` only). Reclassified as patch P9. Caveat noted: Realtime `postgres_changes` subscribes to tables via the publication, not views — Story 9.3 will need to either (a) restrict columns on `public.orders` for anon via column-level GRANT in addition, or (b) switch its Realtime approach (broadcast / poll). [supabase/migrations/20260520160000_add_order_status_enum.sql:25-27]
- [x] [Review][Decision] Error-message conflation → **resolved: split all four into distinct codes** via `ActionResult.code` field. Reclassified as patch P10. [actions/orderActions.ts:144-145, 170-173]
- [x] [Review][Decision] Task 6 manual smoke test → **resolved: defer to review→done transition**. Task 6 stays unchecked; sprint-status `9-1` MUST NOT advance to `done` until smoke test is executed. Gate documented in story file. [story Task 6, unchecked]
- [x] [Review][Decision] Test 5 "anon SELECT any tenant" ratchet → **resolved: keep as-is per spec**. Accepted ratchet risk; the Dev Notes "Customer auth model" comment already documents intent. **Note:** with the view approach above, the test target may need to change to assert the view's permissive grant rather than the orders policy. [tests/rls/order-status.spec.ts:135-153]

**Patches** (all applied 2026-05-20):

- [x] [Review][Patch] Optimistic-concurrency `.eq('status', currentStatus)` filter silently swallowed as success — now uses `count: 'exact'` and returns `{ code: 'CONCURRENT_UPDATE' }` on 0-row match. [actions/orderActions.ts:177-194]
- [x] [Review][Patch] Runtime guard for `nextStatus` added: short-circuits before auth/DB if input is null/undefined/unknown-string/`received`. Tested via parameterized `it.each` with 5 cases. [actions/orderActions.ts:138-145]
- [x] [Review][Patch] Unit-test mock now captures `.eq()` argument pairs for both the select-status read chain and the update chain; every success test asserts `_updateEqCalls` matches `[{id, orderId}, {status, currentStatus}]`. [tests/unit/actions/orderActions.test.ts:196-260]
- [x] [Review][Patch] Stale-state concurrency unit test added: simulates `count: 0` on UPDATE response and asserts `CONCURRENT_UPDATE` code. [tests/unit/actions/orderActions.test.ts]
- [x] [Review][Patch] AC #4 invalid-transition test added at RLS layer: documents that DB does NOT enforce transitions (no SQL CHECK constraint per Task 1) and asserts a skip-ahead UPDATE succeeds at SQL level, proving the action's validator is the only enforcement. [tests/rls/order-status.spec.ts]
- [~] [Review][Patch] RLS spec test 2 optimistic-concurrency filter — **verified not needed**: lines 93/104/116 already include `.eq('status', currentStatus)` for all three workflow advances. Auditor finding a2 was a false alarm.
- [x] [Review][Patch] Tautological "backfill" RLS test replaced with two honest tests: (1) DEFAULT-clause check for new orders, (2) table-wide `is_handled ⇔ status='completed'` invariant. [tests/rls/order-status.spec.ts]
- [x] [Review][Patch] `completed → anything` test expanded to cover preparing, ready, completed via `it.each`. [tests/unit/actions/orderActions.test.ts]
- [x] [Review][Patch] (P9, from D1) View migration applied: `20260520170000_replace_orders_customer_select_with_view.sql` drops `customer_select_order_by_id` policy, creates `public.orders_customer_status` view (`SELECT id, status FROM public.orders`), grants SELECT to anon. Types regenerated. RLS spec tests 4 + 5 updated to query the view; new test asserts anon CANNOT SELECT `public.orders` directly. **Realtime caveat for Story 9.3:** documented in the migration's header and in [[Bridge for Stories 9.2 and 9.3]].
- [x] [Review][Patch] (P10, from D2) Error codes split via `ActionResult.code`: `NOT_AUTHENTICATED`, `NOT_FOUND`, `INVALID_TRANSITION`, `UPDATE_FAILED`, `CONCURRENT_UPDATE`. Unit tests assert `code` per path. [actions/orderActions.ts:132-198]
- [x] [Review][Patch] (Gate, from D3) Done-gate note added below.

---

### ⛔ Done Gate (per code-review D3 + memory `feedback_real_db_smoke_test.md`)

**Sprint-status MUST NOT flip `9-1-order-status-data-model-server-action` from `review` → `done` until Task 6 (manual smoke test against a real DB) is executed and its sub-checkboxes are checked off.**

`advanceOrderStatus` is an owner-side cookie-client Server Action that writes under RLS — exactly the case the memory rule covers. Mocked unit tests are necessary but not sufficient. The smoke test in Task 6 must be run by the user (or substituted with a Playwright e2e) before the story is marked done.

**Deferred** (pre-existing or out of scope):

- [x] [Review][Defer] Migration is non-idempotent (no `IF NOT EXISTS`, no DOWN script) [supabase/migrations/20260520160000_add_order_status_enum.sql] — deferred, pre-existing project convention (one-shot migrations applied via MCP).
- [x] [Review][Defer] `UPDATE public.orders SET status = ...` is a full-table rewrite with no batching [supabase/migrations/20260520160000_add_order_status_enum.sql:16-19] — deferred, acceptable at current scale (32 rows).
- [x] [Review][Defer] Race window between `ADD COLUMN status` (no default) and `SET NOT NULL`: concurrent INSERTs could land NULL [supabase/migrations/20260520160000_add_order_status_enum.sql:13-23] — deferred, unavoidable given the backfill-CASE-from-`is_handled` requirement (the safe single-statement `ADD COLUMN ... DEFAULT 'received' NOT NULL` form would lose the backfill mapping).
- [x] [Review][Defer] `orderId` not validated as UUID before DB call [actions/orderActions.ts:140] — deferred, pre-existing pattern shared with `markOrderHandled` / `unbumpOrder`.
- [x] [Review][Defer] `handled_at` set from `new Date().toISOString()` on the app server, not DB-side `now()` [actions/orderActions.ts:160-162] — deferred, pre-existing pattern matching `markOrderHandled`.
- [x] [Review][Defer] Loose payload type for `is_handled`/`handled_at` — no tagged union enforcing the `completed`-only coupling [actions/orderActions.ts:156-162] — deferred, code is correct; refactor is style-only.
- [x] [Review][Defer] `console.error('[advanceOrderStatus]', error)` may leak raw Postgres error context to logs [actions/orderActions.ts:171] — deferred, pre-existing project pattern.
- [x] [Review][Defer] `signInAsOwner` test session lifetime is not refreshed between assertions — JWT could expire mid-suite [tests/rls/order-status.spec.ts] — deferred, pre-existing helper behavior, no observed flakes.
- [x] [Review][Defer] `beforeAll` partial-failure path would dereference undefined `restA`/`restB` in `afterAll` cleanup [tests/rls/order-status.spec.ts:31-49] — deferred, pre-existing test pattern shared with `tenant-isolation.spec.ts`.
- [x] [Review][Defer] Six fixture builders (`makeOrder` in `KdsScreen`, `OrderCard`, `OrderFeed`, `OrderTicket`, `RealtimeProvider`, `orderStore` test files) duplicate the same factory — adding `status` required editing six files [tests/unit/admin/*, tests/unit/shared/*, tests/unit/stores/*] — deferred, pre-existing tech debt; consolidating would expand the diff beyond story scope.

## Dev Notes

### Customer auth model — why the anon SELECT policy is permissive

The customer flow is **sessionless**: customers never get `auth.users` rows (purged 2026-05-18 per `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-18b.md`). This means:

- The customer's browser client speaks to Supabase as the **`anon` role** (no JWT user).
- The Realtime subscription for Story 9.3 (`orders` filtered by `id=eq.{orderId}`) is evaluated against `anon`-role RLS, not against any user JWT.
- RLS policies on `anon` have no access to URL params, headers, or any "the customer typed in the right table number" context. The policy can only see column values.

Therefore the new `customer_select_order_by_id` policy is `USING (true)` for `anon`. The **real** security boundary is upstream:
1. The customer can only learn an `order_id` via `submitOrder`'s return value (Story 9.3 will change `submitOrder` to return `id`; **not in 9.1 scope**).
2. The SSR fetch on the confirmation screen (Story 9.3, admin client) validates the `(restaurant_slug, table_number, order_id)` tuple before rendering.
3. UUIDs (~10³⁶ entropy) are the implicit auth token. An attacker who guesses the UUID can read the status — acceptable, since order status carries no PII beyond what's already in the confirmation URL.

If you find yourself trying to make the policy "smarter" (joining `tables` and `restaurants`, checking `auth.jwt() -> 'app_metadata'`, etc.), **stop**. The anonymous-JWT path was removed 2026-05-18 (see memory `project_supabase_anon_role.md`). Re-introducing JWT claims here would reintroduce that design. The permissive policy is intentional.

### Bridge for Stories 9.2 and 9.3

- **Story 9.2 (Admin UI)** will: deprecate and remove `markOrderHandled` and `unbumpOrder`; add inline status controls on `OrderCard` calling `advanceOrderStatus`; add `updateStatus(orderId, status)` to `orderStore.ts`; migrate `OrderFeed`'s Handled-tab filter from `is_handled=true` to `status='completed'`. After 9.2 lands, the `is_handled` column becomes vestigial (still set by `advanceOrderStatus(_, 'completed')` for safety) and a follow-up migration may drop it.
- **Story 9.3 (Customer tracking)** will: change `submitOrder` to return the newly inserted `id` (no `.select()` on customer INSERT per project-context anti-patterns — use `.insert([row]).select('id').single()` with the **admin client** which bypasses RLS, so RETURNING is safe); thread the id into the URL and the `OrderConfirmationScreen`; subscribe via the browser client to `orders` filtered by `id=eq.{orderId}`; add SSR fetch via admin client. **None of this is in 9.1.**

### Files this story touches (UPDATE) vs. files it must NOT touch

**UPDATE in 9.1:**
- `supabase/migrations/{new file}` — NEW
- `types/supabase.ts` — REGENERATED (not hand-edited)
- `types/app.ts` — add `OrderStatus`, extend `Order` interface
- `actions/orderActions.ts` — add `advanceOrderStatus` (no edits to existing exports)
- `tests/unit/actions/orderActions.test.ts` — add suite for `advanceOrderStatus`
- `tests/rls/order-status.spec.ts` — NEW

**MUST NOT touch in 9.1:**
- `components/admin/OrderFeed.tsx`, `OrderCard.tsx`, `KdsScreen.tsx`, `OrderTicket.tsx` — Story 9.2 territory
- `components/customer/OrderConfirmationScreen.tsx` and `app/[restaurant_slug]/[table_number]/cart/page.tsx` — Story 9.3 territory
- `components/shared/RealtimeProvider.tsx` — already broadcasts UPDATE events (Story 5.1/8.3); AC #3 explicitly says no changes here
- `stores/orderStore.ts` — Story 9.2 will add a status action; 9.1 has no UI consumer
- `app/platform/tenants/[restaurant_id]/page.tsx` — uses `is_handled`; leave alone (cross-cutting Story 9.2 follow-up if at all)

### Anti-pattern reminders (from project-context)

| Anti-pattern | Correct pattern (this story) |
|---|---|
| `throw new Error(...)` in a Server Action | `return { success: false, error: 'Invalid status transition' }` |
| `.update(row).select().single()` after RLS UPDATE | `.update(payload).eq('id', ...).eq('status', ...)` — no `.select()` |
| Editing `types/supabase.ts` by hand | Regenerate after applying the migration |
| Mocking Supabase in RLS tests | Real DB only; `npm run test:rls` |
| `setTimeout` for polling fallback | N/A — Story 9.1 has no polling surface; the existing `RealtimeProvider` handles UPDATE events already |

### Why the optimistic-concurrency filter `eq('status', currentStatus)`

Without this filter, two concurrent calls could both advance the same order: caller A reads `received`, caller B reads `received`, both write `preparing`. With the filter, caller B's UPDATE matches 0 rows and the row is unchanged (caller A's UPDATE wins). The Server Action returns success in both cases — that's fine because the *invariant* (status is one-step ahead of where it was) holds. If you'd rather report failure to caller B, post-check with a `RETURNING`-less follow-up SELECT — but per the 42501 rule, keep the UPDATE itself RETURNING-less.

### Realtime: what's already in place, and what is NOT changing

`components/shared/RealtimeProvider.tsx` (lines 76–101) already attaches **separate** `.on('postgres_changes', { event: 'INSERT', ... })` and `.on('postgres_changes', { event: 'UPDATE', ... })` listeners filtered by `restaurant_id`. The Order store has `updateOrder` (line 29 of `stores/orderStore.ts`) which reconciles the payload. **Therefore: do not change `RealtimeProvider` in this story**, and ignore the AC line "`event: '*'` ... replacing the prior INSERT-only subscription" — that wording reflects an earlier design assumption that has been superseded by the actual Story 5.1 implementation.

### Project-context cross-references

- Supabase client selection: `docs/conventions/supabase-clients.md` (owner = cookie client; customer = admin client server-side / browser client client-side)
- RLS / `is_handled` history: `supabase/migrations/20260509144631_rls_policies.sql` (`owner_update_orders` is the policy that gates `advanceOrderStatus`)
- 42501 trap detail: `memory/project_postgres_42501_returning.md`
- Anonymous role nuance: `memory/project_supabase_anon_role.md`
- Real-DB smoke test requirement: `memory/feedback_real_db_smoke_test.md`

### Project Structure Notes

- Migration filename uses the project's hand-narrated style (`{YYYYMMDDHHMMSS}_{snake_case_description}.sql`), not the `supabase db diff` output style — matches every existing migration in the repo.
- `types/app.ts` is the only file allowed to grow with new domain types; **not** `types/supabase.ts` (auto-generated).
- RLS spec file goes under `tests/rls/` and runs via `npm run test:rls`; **not** `tests/unit/` (Vitest excludes `tests/rls/**`).
- No new directory or new top-level module is created — strictly additive within existing files except for the two new files (migration + RLS spec).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.1: Order Status Data Model & Server Action]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9: Customer Order Status Tracking]
- [Source: _bmad-output/project-context.md#Supabase Client Selection — wrong client = silent data bugs]
- [Source: _bmad-output/project-context.md#Sessionless customer flow]
- [Source: _bmad-output/project-context.md#Anti-patterns]
- [Source: _bmad-output/project-context.md#Testing Rules]
- [Source: _bmad-output/implementation-artifacts/5-1-real-time-order-feed-with-polling-fallback.md] — RealtimeProvider already subscribes to UPDATE events
- [Source: _bmad-output/implementation-artifacts/8-3-bump-to-complete-workflow-with-undo.md#Task 1] — `unbumpOrder` precedent for an owner-side, RLS-gated, no-`.select()` UPDATE Server Action
- [Source: supabase/migrations/20260509144631_rls_policies.sql] — `owner_update_orders` is the policy that authorizes `advanceOrderStatus`
- [Source: supabase/migrations/20260518210000_add_orders_to_realtime_publication.sql] — `public.orders` already in `supabase_realtime` publication
- [Source: supabase/migrations/20260518230000_remove_anonymous_customer_pattern.sql] — context for why anon-role policies are dormant/permissive

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Task 4: `makeOwnerClient` mock adapted from story sketch to properly chain `.select().eq().single()` and `.update().eq().eq()` as separate return chains. The story's sketch used a single `from` mock returning both methods; the working impl returns separate chain objects per method to let assertions distinguish the two calls.
- Task 1: `mcp__supabase__generate_typescript_types` used (MCP remote generation) instead of the local CLI command, since the Supabase project is remote. Types written to `types/supabase.ts` manually from the MCP output.
- TS fixture fix: Adding `status: OrderStatus` as required on `Order` caused 6 existing `makeOrder` factory functions in unit tests to fail type-check. Added `status: 'received'` default to each. All 477 unit tests continue to pass.

### Completion Notes List

- Applied migration `20260520160000_add_order_status_enum.sql` via Supabase MCP. Verified: `orders.status` enum column present with default `received`; backfill correct (10 `completed`/`is_handled=true`, 22 `received`/`is_handled=false`); `customer_select_order_by_id` policy created for `anon` role.
- `types/supabase.ts` regenerated — `Enums.order_status` and `orders.Row.status` now present.
- `OrderStatus` type alias added to `types/app.ts`; `Order` interface extended with required `status: OrderStatus` field.
- `advanceOrderStatus` Server Action added to `actions/orderActions.ts` using owner cookie client, `VALID_NEXT_STATUS` transition map, optimistic-concurrency `.eq('status', currentStatus)` filter, no `.select()` after UPDATE (42501 guard). `completed` transition atomically sets `is_handled=true` and `handled_at`.
- 9 unit tests added in `tests/unit/actions/orderActions.test.ts` — all pass. Cover each valid transition, all invalid transitions, `completed` payload shape, no-session guard, UPDATE error, read error.
- RLS spec `tests/rls/order-status.spec.ts` created with 5 tests: backfill assertion, full workflow advance, cross-tenant denial, anon SELECT, and intentional permissive-policy assertion (design documentation).
- Task 6 (manual smoke test) left for user to execute per `feedback_real_db_smoke_test.md` discipline.

### File List

- `supabase/migrations/20260520160000_add_order_status_enum.sql` — NEW
- `supabase/migrations/20260520170000_replace_orders_customer_select_with_view.sql` — NEW (code-review follow-up)
- `types/supabase.ts` — REGENERATED twice (enum + view)
- `types/app.ts` — added `OrderStatus` type alias, extended `Order` interface
- `actions/orderActions.ts` — added `OrderStatus` import, `VALID_NEXT_STATUS` map, `advanceOrderStatus` action (with code-review hardening: runtime guard, `count: 'exact'` 0-row check, distinct error codes)
- `tests/unit/actions/orderActions.test.ts` — added `makeOwnerClient` builder and 14 `advanceOrderStatus` unit tests (parameterized): 23 tests total in file
- `tests/unit/admin/KdsScreen.test.tsx` — added `status: 'received'` to `makeOrder` factory
- `tests/unit/admin/OrderCard.test.tsx` — added `status: 'received'` to `makeOrder` factory
- `tests/unit/admin/OrderFeed.test.tsx` — added `status: 'received'` to `makeOrder` factory
- `tests/unit/admin/OrderTicket.test.tsx` — added `status: 'received'` to `makeOrder` factory
- `tests/unit/shared/RealtimeProvider.test.tsx` — added `status: 'received'` to `makeOrder` factory
- `tests/unit/stores/orderStore.test.ts` — added `status: 'received'` to `makeOrder` factory
- `tests/rls/order-status.spec.ts` — NEW; rewritten during code-review: 7 tests covering DEFAULT, invariant, owner advance, cross-tenant denial, AC #4 invalid-transition, view-based anon SELECT, view-only access boundary

### Change Log

- 2026-05-20: Story 9.1 implemented — order_status enum migration applied, advanceOrderStatus Server Action added, 9 unit tests + RLS integration test spec created (claude-sonnet-4-6)
- 2026-05-20: Code-review patches applied (claude-opus-4-7) — 10 patches resolved (1 false-alarm dismissed). Action refactored with `count: 'exact'` 0-row check, runtime `nextStatus` guard, distinct `ActionResult.code` per failure mode. View migration `20260520170000_replace_orders_customer_select_with_view.sql` applied; types regenerated. Unit suite grew from 9 → 23 tests via parameterized cases. RLS spec rewritten: tautological backfill test replaced with DEFAULT-clause + invariant tests; AC #4 invalid-transition test added; view-based anon tests replace direct-orders anon tests. Done-gate documented.
