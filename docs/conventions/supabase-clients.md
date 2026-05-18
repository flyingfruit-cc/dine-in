# Supabase Client Selection

Three Supabase clients are available in this project. Picking the wrong one is the single most common source of "tests pass but the feature is broken in production" bugs. Use this table whenever you're writing a Server Action, page, or Client Component that touches Supabase.

## The three clients

| Client | Where it lives | What it carries | Use it for |
|---|---|---|---|
| **Server (cookie-based)** | `lib/supabase/server.ts` → `createClient()` | The current user's JWT (owner *or* anonymous customer) read from cookies | **Writes that must pass RLS.** Server Actions, route handlers, and Server Components that need to act *as the user*. |
| **Admin (service role)** | `lib/supabase/admin.ts` → `createAdminClient()` | Service role key — bypasses RLS entirely | **Server-side reads where RLS would otherwise block** (e.g., menu data read for an anonymous customer when the customer's JWT can't see the row yet), and admin-only mutations. **Never** use for customer-facing writes — losing RLS validation is a security regression. |
| **Browser** | `lib/supabase/client.ts` → `createClient()` (`createBrowserClient`) | The current user's JWT in the browser | **Client Component reads** and **Realtime subscriptions**. |

## The asymmetry, stated bluntly

- **Customer-facing reads** of menu data are done with the **admin client** on the server. Anonymous JWTs don't (yet) have the `app_metadata` claims needed for customer RLS to pass on first paint, and we don't want to add an extra round-trip just to issue a session before SSR.
- **Customer-facing writes** (`submitOrder`) are done with the **server (cookie-based) client**. The customer's JWT carries `is_anonymous=true` plus `app_metadata.restaurant_id` / `table_number`, which `customer_insert_order` RLS validates against the inserted row. Using the admin client here would silently lose that RLS guarantee.
- **Owner-facing reads/writes** use the **server (cookie-based) client** for SSR and Server Actions, and the **browser client** for Client Components and Realtime subscriptions.

## Realtime subscriptions (browser only)

`postgres_changes` events are evaluated against RLS just like a SELECT. The subscribing user must be able to read the row through RLS, or the event is silently dropped (no error, no callback). In practice:

1. The browser client is used (`createBrowserClient`).
2. Before calling `.subscribe()`, the user's access token must be propagated to the Realtime socket:
   ```ts
   const { data: { session } } = await supabase.auth.getSession()
   if (session?.access_token) await supabase.realtime.setAuth(session.access_token)
   ```
   Skipping this step is the #1 reason a `postgres_changes` channel reaches `SUBSCRIBED` but never fires any payload callbacks.
3. The channel filter (`restaurant_id=eq.{restaurantId}`) is a delivery-layer filter — it does **not** replace RLS. Both are required for correct multi-tenant isolation.

## The `42501` overload (the bug that motivated this doc)

PostgreSQL emits the same error code (`42501`, "violates row-level security policy") for two distinct failures:

1. The `WITH CHECK` clause of an INSERT/UPDATE policy returned false.
2. The implicit SELECT used for an `INSERT ... RETURNING` clause was blocked by SELECT RLS (because no SELECT policy permits the inserting user to read the new row).

Both look identical from the client. **When debugging `42501`, retry the INSERT without `RETURNING`** (`.insert(row)` instead of `.insert(row).select().single()`). If it succeeds, the failure is on the RETURNING/SELECT side, not WITH CHECK.

### Default rule for customer-facing INSERTs

Use `.insert(row)` (no `.select()`). Only add `RETURNING` when (a) the client genuinely consumes the returned row, and (b) a customer-readable SELECT policy exists. `submitOrder` follows this rule (`actions/orderActions.ts`).

## The custom access token hook

For customer RLS to work at all, the `public.custom_access_token_hook` function must be **registered in Supabase Dashboard → Authentication → Hooks → Custom Access Token**. This is a manual step that cannot be automated via SQL or MCP. If `auth.jwt() -> 'app_metadata'` returns `null` in a customer-RLS check, the hook is almost certainly not registered.

## Where this rule is cross-referenced in code

- `actions/orderActions.ts` — uses server client for INSERT; deliberately no `.select()`.
- `components/shared/RealtimeProvider.tsx` — uses browser client + explicit `realtime.setAuth(...)` before subscribing.
- `actions/customerActions.ts` (`initAnonymousSession`) — issues the anonymous JWT and refreshes after attaching `app_metadata`.
