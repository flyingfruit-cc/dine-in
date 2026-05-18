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
--
-- See: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-18b.md

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
