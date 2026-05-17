ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS has_previewed_menu boolean DEFAULT false NOT NULL;
