-- Story 7.1: Add total_cents to orders for fast revenue aggregation.
-- Historical rows default to 0 — acceptable (no real historical orders in production yet).
ALTER TABLE public.orders
  ADD COLUMN total_cents integer NOT NULL DEFAULT 0
    CONSTRAINT orders_total_cents_non_negative CHECK (total_cents >= 0);

-- Composite index supports period range scans (restaurant_id = X AND submitted_at BETWEEN ...)
-- as well as the existing order-feed sort (submitted_at DESC per restaurant).
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_submitted_at
  ON public.orders (restaurant_id, submitted_at DESC);
