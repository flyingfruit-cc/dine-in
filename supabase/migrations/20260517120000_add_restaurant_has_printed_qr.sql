ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS has_printed_qr boolean DEFAULT false NOT NULL;
