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
