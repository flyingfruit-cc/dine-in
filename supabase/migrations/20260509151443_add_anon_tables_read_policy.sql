-- Story 1.2 fix (intermediate): Allow anon role to SELECT from tables.
-- Required for the customer_insert_order RLS policy subquery to resolve table_number.
-- NOTE: superseded by fix_anon_policies_to_authenticated which drops and recreates this
-- policy with the correct TO authenticated + is_anonymous guard.
-- Kept for migration history integrity.

CREATE POLICY "customer_read_own_table" ON public.tables
  FOR SELECT TO anon
  USING (
    restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
  );
