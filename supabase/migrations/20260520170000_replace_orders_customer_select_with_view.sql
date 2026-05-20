-- Story 9.1 follow-up (code-review D1): replace permissive customer SELECT policy
-- on public.orders with a column-restricted view exposing only (id, status).
-- Resolves the column-exposure concern: previously `customer_select_order_by_id`
-- allowed anon to SELECT * (items, total_cents, restaurant_id, table_id, handled_at).
-- The customer flow only ever needs (id, status); the SSR fetch in Story 9.3 uses
-- the admin client which bypasses RLS for full-row reads.
--
-- Realtime caveat for Story 9.3:
--   postgres_changes subscribes to tables (via the supabase_realtime publication),
--   not views. After this migration, anon can no longer SELECT public.orders
--   directly via Realtime. Story 9.3 will need to either:
--     (a) re-add a column-limited policy on public.orders for anon (to restrict
--         Realtime payload columns), or
--     (b) switch the customer status-tracking surface to Realtime broadcast
--         or short-poll the orders_customer_status view.
--   This decision is deferred to Story 9.3.

DROP POLICY IF EXISTS "customer_select_order_by_id" ON public.orders;

-- View runs with owner (postgres) privileges by default, bypassing RLS on the
-- underlying table. This is the intended behavior: anon's only path to read
-- order state is through this view's (id, status) projection.
CREATE VIEW public.orders_customer_status AS
  SELECT id, status FROM public.orders;

GRANT SELECT ON public.orders_customer_status TO anon;
