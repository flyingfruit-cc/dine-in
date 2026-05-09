-- Story 1.2 fix: Supabase anonymous sign-ins use role 'authenticated', not 'anon'.
-- The 'anon' PostgreSQL role only applies to unauthenticated requests (no JWT).
-- Anonymous customers are identified by the is_anonymous = true JWT claim.
-- All three customer-facing policies must target TO authenticated with that guard.

-- menu_items: customer read (published items for their restaurant)
DROP POLICY IF EXISTS "customer_read_menu" ON public.menu_items;
CREATE POLICY "customer_read_menu" ON public.menu_items
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'is_anonymous')::boolean = true
    AND is_published = true
    AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
  );

-- orders: customer insert (own restaurant + verified table_number claim)
DROP POLICY IF EXISTS "customer_insert_order" ON public.orders;
CREATE POLICY "customer_insert_order" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'is_anonymous')::boolean = true
    AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND (
      SELECT t.number
      FROM public.tables t
      WHERE t.id = table_id
        AND t.restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    ) = (auth.jwt() -> 'app_metadata' ->> 'table_number')::integer
  );

-- tables: customer read (own restaurant, needed for the orders policy subquery)
DROP POLICY IF EXISTS "customer_read_own_table" ON public.tables;
CREATE POLICY "customer_read_own_table" ON public.tables
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'is_anonymous')::boolean = true
    AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
  );
