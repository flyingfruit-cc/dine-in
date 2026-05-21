-- Strengthen restaurant language invariants: backfill, change default, add defense-in-depth CHECKs.

-- 1) Backfill: any restaurant whose supported_languages is empty gets 'en'.
UPDATE public.restaurants
SET supported_languages = ARRAY['en']::text[]
WHERE supported_languages = ARRAY[]::text[]
   OR supported_languages IS NULL;

-- 2) Future rows: default to ['en'] so a freshly-onboarded restaurant is translation-ready.
ALTER TABLE public.restaurants
  ALTER COLUMN supported_languages SET DEFAULT ARRAY['en']::text[];

-- 3) Defense-in-depth CHECKs: lock the invariants that the Server Action already enforces,
--    so any future code path (admin SQL, edge functions, ad-hoc maintenance) cannot bypass them.
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_supported_languages_nonempty;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_supported_languages_nonempty
  CHECK (array_length(supported_languages, 1) >= 1);

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_supported_languages_includes_en;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_supported_languages_includes_en
  CHECK ('en' = ANY(supported_languages));

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_default_language_in_supported;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_default_language_in_supported
  CHECK (default_language = ANY(supported_languages));
