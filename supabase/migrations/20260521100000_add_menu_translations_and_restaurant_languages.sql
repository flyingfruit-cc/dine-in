-- Add translation support to menu_items and language configuration to restaurants

-- menu_items: per-item translation content keyed by language code
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb NOT NULL;

-- restaurants: which languages the owner has enabled and the canonical fallback
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS supported_languages text[] DEFAULT ARRAY[]::text[] NOT NULL;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'en' NOT NULL;

-- Enforce only the Phase-2 allowed set at the DB layer
-- (CHECK is preferred over an enum so adding languages is a one-line constraint swap)
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_supported_languages_check
  CHECK (supported_languages <@ ARRAY['en','es','fr','ja','zh']::text[]);

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_default_language_check
  CHECK (default_language IN ('en','es','fr','ja','zh'));

-- Atomic per-language translation update via jsonb_set.
-- SECURITY INVOKER means existing RLS on menu_items still applies — no tenant bypass.
-- Returns the updated row so callers can refresh local state without an extra round-trip.
CREATE OR REPLACE FUNCTION public.update_menu_item_translation(
  item_id uuid,
  lang_code text,
  payload jsonb
)
RETURNS SETOF public.menu_items
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.menu_items
  SET translations = jsonb_set(translations, ARRAY[lang_code], payload, true)
  WHERE id = item_id
    AND restaurant_id = public.get_my_restaurant_id()
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_menu_item_translation(uuid, text, jsonb) TO authenticated;
