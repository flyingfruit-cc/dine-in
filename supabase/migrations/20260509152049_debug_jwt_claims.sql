-- Transient diagnostic: returns auth.jwt() claims for the current request.
-- Used to verify app_metadata is present in anonymous user JWTs.
-- Dropped immediately in the next migration (drop_debug_jwt_claims).

CREATE OR REPLACE FUNCTION public.debug_jwt_claims()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.jwt();
$$;

GRANT EXECUTE ON FUNCTION public.debug_jwt_claims() TO anon, authenticated;
