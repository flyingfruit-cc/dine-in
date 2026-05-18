-- Story 5.1: enable Supabase Realtime postgres_changes for public.orders.
-- Without this, the admin UI's RealtimeProvider channel reaches SUBSCRIBED
-- but no INSERT payloads are delivered (events are filtered out at the WAL
-- publication boundary), and the polling fallback would be the only delivery
-- path even when the WebSocket is healthy.
--
-- Idempotent: re-adding the same table to a publication raises an error in
-- Postgres, so we guard with pg_publication_tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
