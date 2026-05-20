-- Story 7.1: Analytics aggregation function.
-- SECURITY INVOKER (not DEFINER) so that RLS on `orders` still applies when an
-- authenticated owner calls this function — they see only their own restaurant's rows.
-- Service-role callers bypass RLS as usual, enabling the platform-admin path (Story 6.2).
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
    -- Defense-in-depth: explicit restaurant_id filter alongside RLS
    SELECT items, submitted_at, total_cents
    FROM public.orders
    WHERE restaurant_id = p_restaurant_id
      AND submitted_at >= p_start
      AND submitted_at <  p_end
  ),
  totals AS (
    SELECT
      COUNT(*)::int                       AS order_count,
      COALESCE(SUM(total_cents), 0)::int  AS total_revenue_cents
    FROM filtered
  ),
  by_day AS (
    SELECT
      to_char(date_trunc('day', submitted_at), 'YYYY-MM-DD')  AS day,
      COUNT(*)::int                                           AS cnt,
      COALESCE(SUM(total_cents), 0)::int                      AS rev
    FROM filtered
    GROUP BY date_trunc('day', submitted_at)
  ),
  by_dow_hour AS (
    SELECT
      EXTRACT(DOW  FROM submitted_at)::int  AS dow,
      EXTRACT(HOUR FROM submitted_at)::int  AS hr,
      COUNT(*)::int                         AS cnt
    FROM filtered
    GROUP BY EXTRACT(DOW FROM submitted_at), EXTRACT(HOUR FROM submitted_at)
  ),
  -- Unnest items jsonb array; historical rows without unit_price_cents contribute 0 revenue
  items_flat AS (
    SELECT
      item->>'name'                                             AS nm,
      (item->>'quantity')::int                                  AS qty,
      (item->>'quantity')::int
        * COALESCE((item->>'unit_price_cents')::int, 0)         AS rev,
      CASE
        WHEN item->'variants' IS NULL
          OR jsonb_array_length(item->'variants') = 0 THEN 'standard'
        ELSE (
          SELECT string_agg(v, ', ' ORDER BY v)
          FROM jsonb_array_elements_text(item->'variants') v
        )
      END                                                       AS vlabel
    FROM filtered, jsonb_array_elements(items) AS item
    WHERE item->>'name' IS NOT NULL
  ),
  variant_sums AS (
    SELECT
      nm,
      vlabel,
      SUM(qty)::int  AS vqty,
      SUM(rev)::int  AS vrev
    FROM items_flat
    GROUP BY nm, vlabel
  ),
  top_items AS (
    SELECT
      nm                            AS name,
      SUM(vqty)::int                AS quantity,
      SUM(vrev)::int                AS revenue_cents,
      jsonb_object_agg(vlabel, vqty) AS variants
    FROM variant_sums
    GROUP BY nm
    ORDER BY SUM(vqty) DESC
    LIMIT 10
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
                  ORDER BY quantity DESC
                )
         FROM top_items),
        '[]'::jsonb
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_analytics(uuid, timestamptz, timestamptz)
  TO authenticated, service_role;
