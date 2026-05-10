-- Story 2.2: Add image_url to menu_items for Supabase Storage CDN links
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text;
