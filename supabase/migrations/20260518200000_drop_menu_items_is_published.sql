-- menu_items.is_published was never set to true by any code path.
-- The restaurant-level is_published gate in page.tsx already prevents
-- customers from seeing the menu when the restaurant is offline.
-- Remove the dead column and update the RLS policy accordingly.

-- Drop the dependent policy first, then drop the column, then recreate.
DROP POLICY IF EXISTS "customer_read_menu" ON public.menu_items;

ALTER TABLE public.menu_items DROP COLUMN IF EXISTS is_published;

CREATE POLICY "customer_read_menu" ON public.menu_items
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'is_anonymous')::boolean = true
    AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
  );
