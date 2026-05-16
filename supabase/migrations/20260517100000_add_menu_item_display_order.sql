ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Initialize existing rows with sequential values, ordered by created_at within each category.
-- COALESCE handles NULL category_id (uncategorized items form their own group).
UPDATE public.menu_items
SET display_order = sub.row_num - 1
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(category_id::text, '__uncategorized__')
      ORDER BY created_at ASC
    ) AS row_num
  FROM public.menu_items
) AS sub
WHERE public.menu_items.id = sub.id;
