-- Story 1.2: Initial schema — 6 tenant tables with RLS enabled.
-- Applied to hosted Supabase project via MCP on 2026-05-09.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.restaurants (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         text         UNIQUE NOT NULL,
  name         text         NOT NULL,
  is_published boolean      DEFAULT false NOT NULL,
  created_at   timestamptz  DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id                uuid     PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id     uuid     REFERENCES public.restaurants(id) ON DELETE SET NULL,
  is_platform_admin boolean  DEFAULT false NOT NULL
);

CREATE TABLE public.categories (
  id            uuid     DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid     NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text     NOT NULL,
  display_order integer  DEFAULT 0 NOT NULL
);

-- price_cents is ALWAYS integer — never float or decimal
CREATE TABLE public.menu_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id   uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text,
  price_cents   integer     NOT NULL DEFAULT 0,
  is_published  boolean     DEFAULT false NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.tables (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  number        integer     NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (restaurant_id, number)
);

CREATE TABLE public.orders (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      uuid        NOT NULL REFERENCES public.tables(id) ON DELETE RESTRICT,
  items         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  submitted_at  timestamptz DEFAULT now() NOT NULL,
  is_handled    boolean     DEFAULT false NOT NULL,
  handled_at    timestamptz
);

ALTER TABLE public.restaurants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders       ENABLE ROW LEVEL SECURITY;
