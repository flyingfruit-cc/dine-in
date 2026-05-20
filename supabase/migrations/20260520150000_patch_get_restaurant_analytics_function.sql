-- Story 7.1 — code review patches to `get_restaurant_analytics`:
-- P1  COALESCE on (item->>'quantity')::int — avoid 22P02 from malformed history
-- P2  date_trunc('day', submitted_at AT TIME ZONE 'UTC') — pin to UTC, not session TZ
-- P3  EXTRACT(DOW/HOUR FROM submitted_at AT TIME ZONE 'UTC') — same
-- P4  SUM(...)::bigint — avoid 22003 overflow at $21M+ aggregate revenue
-- P5  Guard jsonb_array_elements against non-array `items` via CASE
-- P6  ORDER BY ..., name ASC — deterministic top_items tiebreaker
-- P7  REVOKE EXECUTE FROM PUBLIC explicit — defense for default-grant Postgres < 15
-- P12 LIMIT 50 (was 10) — let caller sort by quantity or revenue without missing items
CREATE OR REPLACE FUNCTION public.get_restaurant_analytics(
  p_restaurant_id uuid,
  p_start         timestamptz,
  p_end           timestamptz
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH filtered AS (
    SELECT items, submitted_at, total_cents
    FROM public.orders
    WHERE restaurant_id = p_restaurant_id
      AND submitted_at >= p_start
      AND submitted_at <  p_end
  ),
  totals AS (
    SELECT
      COUNT(*)::int                          AS order_count,
      COALESCE(SUM(total_cents), 0)::bigint  AS total_revenue_cents
    FROM filtered
  ),
  by_day AS (
    SELECT
      to_char(date_trunc('day', submitted_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')  AS day,
      COUNT(*)::int                                                              AS cnt,
      COALESCE(SUM(total_cents), 0)::bigint                                      AS rev
    FROM filtered
    GROUP BY date_trunc('day', submitted_at AT TIME ZONE 'UTC')
  ),
  by_dow_hour AS (
    SELECT
      EXTRACT(DOW  FROM submitted_at AT TIME ZONE 'UTC')::int  AS dow,
      EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'UTC')::int  AS hr,
      COUNT(*)::int                                            AS cnt
    FROM filtered
    GROUP BY EXTRACT(DOW  FROM submitted_at AT TIME ZONE 'UTC'),
             EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'UTC')
  ),
  items_flat AS (
    SELECT
      item->>'name'                                              AS nm,
      COALESCE((item->>'quantity')::int, 0)                      AS qty,
      COALESCE((item->>'quantity')::int, 0)::bigint
        * COALESCE((item->>'unit_price_cents')::int, 0)::bigint  AS rev,
      CASE
        WHEN item->'variants' IS NULL
          OR jsonb_array_length(item->'variants') = 0 THEN 'standard'
        ELSE (
          SELECT string_agg(v, ', ' ORDER BY v)
          FROM jsonb_array_elements_text(item->'variants') v
        )
      END                                                        AS vlabel
    FROM filtered,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END
         ) AS item
    WHERE item->>'name' IS NOT NULL
  ),
  variant_sums AS (
    SELECT
      nm,
      vlabel,
      SUM(qty)::int     AS vqty,
      SUM(rev)::bigint  AS vrev
    FROM items_flat
    GROUP BY nm, vlabel
  ),
  top_items AS (
    SELECT
      nm                              AS name,
      SUM(vqty)::int                  AS quantity,
      SUM(vrev)::bigint               AS revenue_cents,
      jsonb_object_agg(vlabel, vqty)  AS variants
    FROM variant_sums
    GROUP BY nm
    ORDER BY SUM(vqty) DESC, nm ASC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'order_count',
      (SELECT order_count         FROM totals),
    'total_revenue_cents',
      (SELECT total_revenue_cents FROM totals),
    'orders_by_day',
      COALESCE(
        (SELECT jsonb_agg(
                  jsonb_build_object('day', day, 'count', cnt, 'revenue_cents', rev)
                  ORDER BY day
                )
         FROM by_day),
        '[]'::jsonb
      ),
    'orders_by_dow_hour',
      COALESCE(
        (SELECT jsonb_agg(
                  jsonb_build_object('dow', dow, 'hour', hr, 'count', cnt)
                  ORDER BY dow, hr
                )
         FROM by_dow_hour),
        '[]'::jsonb
      ),
    'top_items',
      COALESCE(
        (SELECT jsonb_agg(
                  jsonb_build_object(
                    'name',          name,
                    'quantity',      quantity,
                    'revenue_cents', revenue_cents,
                    'variants',      variants
                  )
                  ORDER BY quantity DESC, name ASC
                )
         FROM top_items),
        '[]'::jsonb
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_restaurant_analytics(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_restaurant_analytics(uuid, timestamptz, timestamptz)
  TO authenticated, service_role;
