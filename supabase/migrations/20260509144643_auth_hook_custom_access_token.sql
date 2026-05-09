-- Story 1.2: Custom access token hook — pass-through stub.
-- Supabase includes app_metadata in JWTs by default.
-- This hook MUST be registered in the Dashboard for app_metadata claims
-- to be accessible via auth.jwt() -> 'app_metadata' in RLS policies.
--
-- MANUAL STEP REQUIRED after applying this migration:
--   Dashboard → Authentication → Hooks → Custom Access Token
--   → select public.custom_access_token_hook → Save

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Pass through the event unchanged.
  -- Supabase includes app_metadata set via admin API in the JWT by default.
  -- This hook stub is required to be registered so that
  -- auth.jwt() -> 'app_metadata' is accessible in RLS policies.
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
