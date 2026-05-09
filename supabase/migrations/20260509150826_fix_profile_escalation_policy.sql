-- Story 1.2 fix: Block is_platform_admin self-escalation via RLS WITH CHECK.
-- Original owner_update_own_profile allowed setting any column including is_platform_admin.
-- New WITH CHECK adds is_platform_admin = false to prevent privilege escalation.

DROP POLICY IF EXISTS "owner_update_own_profile" ON public.profiles;

CREATE POLICY "owner_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND is_platform_admin = false);
