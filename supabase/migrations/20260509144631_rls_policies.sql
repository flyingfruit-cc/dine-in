-- Story 1.2: RLS policies for restaurant owners and anonymous customers.
-- Uses get_my_restaurant_id() SECURITY DEFINER to avoid RLS recursion
-- and to prevent one subquery per policy row.

-- Helper: resolves the current authenticated user's restaurant_id
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_restaurant_id() TO authenticated;

-- restaurants: owner reads/updates only their own row
CREATE POLICY "owner_select_own_restaurant" ON public.restaurants
  FOR SELECT TO authenticated
  USING (id = public.get_my_restaurant_id());

CREATE POLICY "owner_update_own_restaurant" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (id = public.get_my_restaurant_id())
  WITH CHECK (id = public.get_my_restaurant_id());

-- profiles: owner reads/inserts/updates only their own row (keyed by auth.uid(), not restaurant)
CREATE POLICY "owner_select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "owner_insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Note: WITH CHECK updated in fix_profile_escalation_policy migration
CREATE POLICY "owner_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- categories: owner full CRUD scoped to their restaurant
CREATE POLICY "owner_all_categories" ON public.categories
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- menu_items: owner full CRUD scoped to their restaurant
CREATE POLICY "owner_all_menu_items" ON public.menu_items
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- menu_items: anonymous customer SELECT (published items for their restaurant only)
-- NOTE: superseded by fix_anon_policies_to_authenticated — kept here for migration history
CREATE POLICY "customer_read_menu" ON public.menu_items
  FOR SELECT TO anon
  USING (
    restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND is_published = true
  );

-- tables: owner full CRUD scoped to their restaurant
CREATE POLICY "owner_all_tables" ON public.tables
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- orders: owner SELECT only (INSERT is for anonymous customers only)
CREATE POLICY "owner_select_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id());

CREATE POLICY "owner_update_orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- orders: anonymous customer INSERT (scoped to restaurant + verifies table_number claim)
-- NOTE: superseded by fix_anon_policies_to_authenticated — kept here for migration history
CREATE POLICY "customer_insert_order" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (
    restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND (
      SELECT t.number
      FROM public.tables t
      WHERE t.id = table_id
        AND t.restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    ) = (auth.jwt() -> 'app_metadata' ->> 'table_number')::integer
  );
