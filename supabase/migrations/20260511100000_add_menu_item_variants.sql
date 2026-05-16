ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb NOT NULL;
