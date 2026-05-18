# Sprint Change Proposal — Sessionless Customer Flow

**Date:** 2026-05-18
**Author:** Nic (with Developer agent)
**Revision:** v2 — replaces v1 "trigger guard + retention cleanup". Direction approved by Nic 2026-05-18: drop the anonymous-session pattern entirely rather than schedule a cleanup.

---

## 1. Issue Summary

### Problem statement

Customer-side QR scans create permanent rows in `auth.users` via `supabase.auth.signInAnonymously()` (called by `actions/customerActions.ts::initAnonymousSession`, triggered by the `SessionInitializer` Client Component on the customer page). These rows accumulate without bound — no expiry, no cleanup mechanism — and currently total 17 in local dev alone.

The accumulation is a symptom of a deeper architectural choice: the project gave every customer a persistent Supabase auth identity solely to attach `(restaurant_id, table_number)` to a JWT, so that RLS policies on `orders.INSERT` and `menu_items.SELECT` could enforce multi-tenant isolation against those claims.

### Why this matters

- **Scalability:** monotonic growth of `auth.users` is awkward at multi-restaurant scale and retroactively hard to clean.
- **Complexity:** the anonymous-session machinery contributed two of the three painful bugs in Epic 4 (stale JWT diagnostic loop in 4-5; subscription-without-`setAuth` in 5-1).
- **Manual operational steps:** the design depends on the custom access token hook being registered in Dashboard, a non-automated foot-gun.
- **Threat model gap that this design doesn't actually close:** the JWT's `app_metadata.restaurant_id` is *assigned at session-create time based on the URL the customer landed on* — it's not cryptographically tied to anything secret. RLS validates one URL-derived claim against another URL-derived value. Any attacker can simply scan a different QR to get a different session.

### Evidence

- 17 anonymous `auth.users` rows in live DB, 0 `public.profiles` rows for them.
- Epic 4 retrospective (2026-05-18) lists "stale JWT diagnostic round" as the headline lesson — directly caused by session-creation ordering.
- Story 5-1 review found "RealtimeProvider doesn't `setAuth` on token refresh" as a High-severity bug — caused by JWT-driven RLS on Realtime, which only exists because customers carry JWTs.

---

## 2. Impact Analysis

### Code impact

| File | Action |
|---|---|
| `components/customer/SessionInitializer.tsx` | **Delete** |
| `actions/customerActions.ts` (entire file — only contains `initAnonymousSession`) | **Delete** |
| `app/[restaurant_slug]/[table_number]/page.tsx` | Remove `<SessionInitializer>` mount and any session-setup code |
| `actions/orderActions.ts` | Rewrite signature to accept `(restaurantSlug, tableNumber, cartItems)`; validate `(slug, tableNumber)` via admin client; INSERT order via admin client |
| `app/[restaurant_slug]/[table_number]/cart/page.tsx` | Update `submitOrder` call site to pass URL params explicitly |
| `tests/unit/customer/CartPage.test.tsx` | Update mocked-action signature |
| `tests/rls/anonymous-session.spec.ts` | Either delete or repurpose as a regression test for the new admin-validated insert path |
| `tests/rls/helpers.ts` | `createAnonCustomerClient` and related helpers become unused — keep dormant for now (might come back in a different shape) |
| `docs/conventions/supabase-clients.md` | Update "customer-facing INSERTs use the server client" → "customer-facing INSERTs use the admin client; the Server Action enforces validation" |

### Migration impact

| Migration | Action |
|---|---|
| `supabase/migrations/20260518230000_remove_anonymous_customer_pattern.sql` (NEW) | 1. `handle_new_user` trigger gets a `WHEN NEW.is_anonymous IS DISTINCT FROM true` guard (defensive belt-and-braces, since no anon users should ever be created again). 2. One-shot `DELETE FROM auth.users WHERE is_anonymous = true` to clean the existing 17 rows. |
| `supabase/migrations/20260509144643_auth_hook_custom_access_token.sql` (EXISTING) | Stays in place. The function becomes effectively a no-op (no JWTs will carry `app_metadata` anymore). Drop in a future hardening pass; not load-bearing to drop now. |
| `supabase/migrations/20260509152222_fix_anon_policies_to_authenticated.sql` (EXISTING) | `customer_insert_order`, `customer_read_menu`, `customer_read_own_table` become dormant — no JWT will satisfy them. Drop in a future hardening pass for cleanliness; leaving them in place is harmless. |

### Artifact impact

| Artifact | Change |
|---|---|
| **PRD** | Remove "anonymous session" language from FR21, NFR12 area. Replace with one line: "Customer pages are served sessionlessly; the URL `(slug, table_number)` is the only customer identifier." |
| **Architecture** | Replace the "Anonymous Customer Sessions" subsection with a shorter "Sessionless Customer Flow" subsection. Remove the custom access token hook from "Required Manual Setup" list. |
| **Epics** | Story 1-2 (RLS policies) Dev Notes get an updated comment noting customer-side policies are dormant. No new stories added. **No story rework needed for Epic 1, 2, 3, or 4 — those stories already shipped; only the underlying mechanism changes.** |
| **Epic 4 retrospective** | Add a postscript noting that the headline lesson ("real-DB e2e for customer-facing Server Actions with RLS") is now moot for the customer side since RLS no longer guards that path. The lesson remains valid for owner-side Server Actions. |
| **Deferred-work file** | Several items become resolved or moot (timezone-mismatch JWT decoding, custom-access-token-hook registration, etc.). I'll annotate them inline. |
| **Memory file `project_postgres_42501_returning.md`** | Still valid; keep. |
| **Memory file `feedback_real_db_smoke_test.md`** | Update to clarify that "customer-facing Server Actions with RLS" is now a narrower category since the customer write path no longer goes through RLS. |
| **UX spec** | No change — customer experience identical. |
| **Sprint-status** | No story key changes. Epic 4 stays `in-progress` until Epic 5 is done. |

### Test impact

| Test file | Change |
|---|---|
| `tests/unit/customer/CartPage.test.tsx` | Update `mockSubmitOrder` mock to match new args; no test logic change |
| `tests/unit/customer/OrderConfirmationScreen.test.tsx` | No change |
| `tests/rls/anonymous-session.spec.ts` | Delete or repurpose — anonymous sessions no longer exist |
| `tests/rls/tenant-isolation.spec.ts` | Review — the customer-side scenarios may no longer be relevant; owner-side tenant isolation remains |
| `tests/e2e/realtime-order-delivery.spec.ts` | No change — owner-side test, doesn't touch customer flow |

### Security implications

**Threat model recap.** Customer-side multi-tenant isolation has always been URL-driven, not cryptographically enforced. RLS on `orders.INSERT` validated `(jwt.restaurant_id, jwt.table_number) ↔ new row`, but the JWT's claims came from the URL the customer landed on, set by an admin-client `updateUserById` call. Anyone with a public slug can sign up a session for any table.

**What changes:**

| Concern | Before | After |
|---|---|---|
| Customer can only insert orders for their restaurant + table | RLS validates JWT claim against new row | Server Action validates URL params resolve to a real `(restaurant, table)` pair before inserting |
| Customer can read another restaurant's menu | RLS denies (`customer_read_menu` checks JWT claim) | Already not the case in practice — menu is fetched via admin client filtered by the URL slug |
| Owner can only see their own orders | RLS `owner_select_orders` checks `restaurant_id = get_my_restaurant_id()` | Unchanged — still enforced |
| Owner can only update their own orders | RLS `owner_update_orders` checks `restaurant_id = get_my_restaurant_id()` | Unchanged — still enforced |
| Replay / spam protection | None (anonymous identity is throwaway and unconstrained anyway) | None (same) |
| Defense-in-depth if `submitOrder` has a bug accepting attacker-controlled args | RLS would catch it | Lost — but mitigatable by leaving customer RLS policies in place as dormant guards (zero cost) |

The honest summary: **owner-side security is unchanged. Customer-side security is unchanged in effective threat model, but loses a defense-in-depth layer.** We propose to leave customer-facing RLS policies dormant in the DB so the defense-in-depth layer is reclaimable if a future code path re-introduces customer JWTs.

---

## 3. Recommended Approach

**Path: Direct Adjustment, no new stories, no rollback, no epic replan.**

This is a refactor of existing code, not new feature work. Sprint-status entries stay unchanged. Epic 5 work is not affected — `RealtimeProvider`'s auth handling is owner-side and Realtime auth still flows through the owner JWT.

### Effort estimate (per project convention, no time units)

- Code changes: small — net deletion of ~80 LOC, addition of ~30 LOC.
- Migration: small — one SQL file with two statements.
- Tests: small — one test mock signature change, optionally delete one RLS spec.
- Docs: small — three planning artifacts touched with short edits.

### Risk assessment

- **Low risk:** the customer-side RLS was never the load-bearing security control. Moving validation to the Server Action layer matches what the codebase already does for menu data reads.
- **Medium risk to watch:** any code that reads the anonymous user's JWT for any purpose other than restaurant_id propagation (none in the current codebase, but worth a final grep before merging).
- **Zero risk to order history:** `orders` has no FK to `auth.users`. Deleting the 17 stale anonymous users does not delete any order rows. Verified.

### Rollback plan

If anything goes wrong post-merge:
1. Revert the file changes — `SessionInitializer` and `initAnonymousSession` come back from git.
2. The migration's `DELETE FROM auth.users WHERE is_anonymous = true` is not reversible (anonymous users are throwaway by definition; nothing references them post-purge). This is a one-way change but the value being thrown away is exactly the bloat we want to clean.

---

## 4. Detailed Change Proposals

### 4.1 New migration

**File:** `supabase/migrations/20260518230000_remove_anonymous_customer_pattern.sql`

```sql
-- Remove the anonymous-customer auth pattern.
--
-- After this migration:
--   1. No customer-facing code will create rows in auth.users.
--   2. The handle_new_user trigger is guarded so any stray anonymous user
--      that somehow gets created in the future won't bloat public.profiles.
--   3. Existing stale anonymous users are purged. Orders are preserved
--      (no FK from public.orders to auth.users).
--
-- Customer-facing RLS policies (customer_insert_order, customer_read_menu,
-- customer_read_own_table) are intentionally left in place as dormant
-- defense-in-depth. They'll never be satisfied because no customer JWT
-- will carry the required claims after this migration ships.

-- Idempotent guard on handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_anonymous IS DISTINCT FROM true THEN
    INSERT INTO public.profiles (id, is_platform_admin)
    VALUES (NEW.id, false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Purge existing stale anonymous customers.
-- orders has no FK to auth.users, so order history is preserved.
DELETE FROM auth.users WHERE is_anonymous = true;
```

### 4.2 Code change: `actions/customerActions.ts`

**Action:** delete the file. Only export is `initAnonymousSession`, which is no longer called.

### 4.3 Code change: `components/customer/SessionInitializer.tsx`

**Action:** delete the file.

### 4.4 Code change: `app/[restaurant_slug]/[table_number]/page.tsx`

**Action:** remove the `<SessionInitializer ... />` mount. The page is already a Server Component that fetches menu data via admin client — no other change needed.

### 4.5 Code change: `actions/orderActions.ts`

**Action:** rewrite `submitOrder`.

```ts
'use server'

// Client-selection rules: see docs/conventions/supabase-clients.md
// Sessionless customer flow: validation lives in this Server Action, not in RLS.
// The admin client is used both for lookups and for the final INSERT.

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, CartItem } from '@/types/app'

export interface SubmitOrderData {
  restaurantName: string
  tableNumber: number
}

export interface SubmitOrderInput {
  restaurantSlug: string
  tableNumber: number
  cartItems: CartItem[]
}

export async function submitOrder({
  restaurantSlug,
  tableNumber,
  cartItems,
}: SubmitOrderInput): Promise<ActionResult<SubmitOrderData>> {
  if (cartItems.length === 0) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const adminClient = createAdminClient()

  const { data: restaurant, error: restError } = await adminClient
    .from('restaurants')
    .select('id, name')
    .eq('slug', restaurantSlug)
    .single()

  if (restError || !restaurant) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const { data: table, error: tableError } = await adminClient
    .from('tables')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNumber)
    .single()

  if (tableError || !table) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const map = new Map<string, { name: string; quantity: number; variants: string[] }>()
  for (const item of cartItems) {
    const variantKey = item.selectedVariants
      .map((v) => `${v.groupId}:${v.optionId}`)
      .sort()
      .join(',')
    const key = `${item.menuItemId}:${variantKey}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity++
    } else {
      map.set(key, {
        name: item.name,
        quantity: 1,
        variants: item.selectedVariants.map((v) => v.optionName),
      })
    }
  }
  const items = Array.from(map.values())

  const { error: insertError } = await adminClient
    .from('orders')
    .insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      items,
      is_handled: false,
    })

  if (insertError) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  return {
    success: true,
    data: {
      restaurantName: restaurant.name,
      tableNumber,
    },
  }
}
```

### 4.6 Code change: `app/[restaurant_slug]/[table_number]/cart/page.tsx`

**Action:** update the call site to pass the URL params explicitly.

```ts
// Before:
const result = await submitOrder(currentItems)

// After:
const result = await submitOrder({
  restaurantSlug: restaurant_slug,
  tableNumber: Number(table_number),
  cartItems: currentItems,
})
```

### 4.7 Test change: `tests/unit/customer/CartPage.test.tsx`

**Action:** update the mock to receive the new arg shape. Existing assertions on `result.success`/`result.error` stay.

### 4.8 RLS spec test: `tests/rls/anonymous-session.spec.ts`

**Action:** delete. No customer auth flow remains to test.

Optionally repurpose into a new `tests/rls/customer-validation.spec.ts` that verifies the Server Action rejects mismatched `(slug, tableNumber)` pairs — but this is unit-test territory, not RLS. Recommend just deleting.

### 4.9 PRD edit

**Section:** Customer Ordering Flow (FR20–29)

```diff
- FR21: The customer page is reached at `/{restaurant_slug}/{table_number}`. On
-       first hit, the server middleware issues an anonymous Supabase session
-       with `app_metadata: { restaurant_id, table_number }`. The session
-       expires after 2 hours with no rolling refresh.
+ FR21: The customer page is reached at `/{restaurant_slug}/{table_number}`.
+       It is served sessionlessly — no auth identity is created for customers.
+       The URL pair is the only customer identifier, validated by the order-
+       submission Server Action against the `restaurants` and `tables` tables.

- NFR12: Pessimistic order submission. The customer JWT carries the table
-        context; RLS validates restaurant_id and table_number claims on INSERT.
+ NFR12: Pessimistic order submission. The Server Action validates that the
+        URL-derived `(slug, table_number)` resolves to a real (restaurant, table)
+        pair before inserting. No customer JWT is involved.
```

### 4.10 Architecture edit

**Section:** Customer Data Access (currently describes anonymous-session pattern)

```diff
- ### Anonymous Customer Sessions
-
- Customers receive an anonymous Supabase session created via
- `supabase.auth.signInAnonymously()` on the first page hit. The session's
- `app_metadata` carries `restaurant_id` and `table_number`. RLS policies
- on `orders`, `menu_items`, and `tables` use these claims to enforce
- multi-tenant isolation.
-
- A custom access token hook (registered in Supabase Dashboard) ensures
- the claims appear in `auth.jwt() -> 'app_metadata'` for RLS evaluation.

+ ### Sessionless Customer Flow
+
+ Customers are served without any auth identity. The URL path
+ `/{restaurant_slug}/{table_number}` is the customer identifier and is
+ validated by Server Actions against `public.restaurants` and `public.tables`.
+
+ - Menu data: fetched in the page's Server Component via the admin client
+   filtered by `restaurant_id` derived from `restaurant_slug`.
+ - Order submission: `submitOrder({restaurantSlug, tableNumber, cartItems})`
+   admin-validates the `(slug, table_number)` pair, then admin-inserts.
+ - No JWTs, no session expiry, no `auth.users` rows for customers.
+ - Customer-facing RLS policies remain in the DB as dormant defense-in-depth.
+
+ The custom access token hook is no longer required by application code.
+ The hook function (`public.custom_access_token_hook`) still exists in the
+ DB as a no-op; it can be removed in a future hardening pass.
```

### 4.11 Epic 4 retrospective postscript

Append to `_bmad-output/implementation-artifacts/epic-4-retro-2026-05-18.md`:

```markdown
## Postscript (2026-05-18, evening)

A sprint-change-proposal (`sprint-change-proposal-2026-05-18b.md`) approved the same day
removes the anonymous customer auth pattern entirely. The Epic 4 retrospective's
headline lesson — "real-DB e2e smoke test required for customer-facing Server Actions
with RLS" — remains valid in principle but is narrower in practice now: the customer
write path no longer goes through RLS. The lesson still applies to any owner-facing
Server Action that hits Postgres under RLS (e.g., Epic 5's `markOrderHandled`).

The Postgres 42501 / RETURNING overload lesson remains fully load-bearing and is
preserved in `docs/conventions/supabase-clients.md`.
```

### 4.12 Deferred-work cleanup

Items resolved or moot after this change:
- "Stale JWT from before hook registration" (Epic 4) — moot, no JWTs for customers
- "Manual custom-access-token-hook Dashboard step" (1-2, 4-1, 4-5) — moot
- "JSONB cast on user.app_metadata" (4-5) — moot, no user.app_metadata read
- "Realtime auth on customer side" — never was a concern (Realtime is owner-side only)

Items that REMAIN valid:
- Owner-side RLS lessons
- All Realtime / RealtimeProvider patches from 5-1 code review
- Postgres 42501 / RETURNING overload

I'll annotate the deferred-work file inline rather than deleting entries — preserves the audit trail.

---

## 5. Implementation Handoff

**Scope:** Moderate (touches code, migrations, planning artifacts, and tests, but no new stories).

**Routing:** Developer agent can implement directly in a single session — there's no PO/PM coordination needed because no scope or AC of an existing story changes. Stories 4-1 through 4-5 stay marked `done` because the customer flow continues to satisfy their ACs; the underlying mechanism is just simpler.

**Suggested execution order:**

1. Apply 4.1 (migration) — wipes the 17 stale anon users and hardens the trigger.
2. Apply 4.2–4.7 (code changes + test fix).
3. Run unit suite (`npm test`) — should be 302+ passing.
4. Run e2e (`npm run test:e2e -- realtime-order-delivery`) — owner-side, should pass unchanged.
5. Apply 4.9–4.11 (PRD, architecture, retro postscript edits).
6. Stage everything and present the diff for human review before merge.

**Success criteria:**
- `auth.users` `is_anonymous = true` count = 0 immediately after migration; stays 0 indefinitely.
- Customer can place an order end-to-end (manual smoke test or existing e2e variation).
- All 302 unit tests pass; e2e passes.
- No regression in owner-side flow.

**What we accept as a known trade-off (not a bug):**
- Customer-facing RLS policies are dormant rather than removed. They cost nothing dormant and provide reclaimable defense-in-depth if a future story re-introduces customer JWTs.
