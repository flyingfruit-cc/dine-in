# Story 2.5: Item Reordering within Category

Status: done

## Story

As a restaurant owner,
I want to reorder menu items within a category,
So that I control the sequence in which items appear to customers.

## Acceptance Criteria

**AC1** — Drag to reorder:
Given an owner is on the Admin menu page at `/admin/menu`
When they drag an item to a new position within its category using the drag handle
Then the item moves to the new position immediately (optimistic UI)
And `display_order` values are saved for all affected items in that category via `reorderMenuItems`
And the new order persists on page reload

**AC2** — Customer-facing order follows display_order:
Given items have been reordered
When the menu is fetched (Admin or customer view)
Then items are returned `ORDER BY display_order ASC` — not by `created_at`

**AC3** — Error rollback:
Given the `reorderMenuItems` Server Action returns an error
When the error is caught
Then items snap back to their previous order immediately
And an inline error message is shown in the affected category section

**AC4** — New items append at the end of their category:
Given items in a category already have display_order values (0, 1, 2…)
When a new item is created in that category
Then it receives `display_order = MAX + 1` — not `0` — so it appears last

## Tasks / Subtasks

- [x] Task 1: DB migration — add `display_order` to `menu_items` (AC: 1, 2, 4)
  - [x] Create `supabase/migrations/20260517100000_add_menu_item_display_order.sql`
  - [x] SQL: `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;`
  - [x] SQL: Run UPDATE to initialize existing rows with sequential values per category (see Dev Notes for exact SQL)
  - [x] Apply via Supabase MCP `apply_migration` tool

- [x] Task 2: TypeScript types — add `display_order` to `MenuItem` and `MenuItemUpdate` (AC: 1, 2)
  - [x] Add `display_order: number` to `MenuItem` interface in `types/app.ts`
  - [x] Add `display_order?: number` to `MenuItemUpdate` interface in `types/app.ts`
  - [x] Do NOT add to `MenuItemCreate` — new items compute display_order via MAX+1 query in the action

- [x] Task 3: Server Actions updates in `actions/menuActions.ts` (AC: 1, 3, 4)
  - [x] Export `reorderMenuItems(updates: { id: string; display_order: number }[]): Promise<ActionResult<void>>`
  - [x] Update `createMenuItem` to compute `display_order = MAX(display_order for same category) + 1` before insert (same pattern as `createCategory`)
  - [x] Write unit tests in `tests/unit/menu/menuActions.reorder.test.ts` (see Dev Notes for test pattern)

- [x] Task 4: Update `MenuPage` item fetch order (AC: 2)
  - [x] In `app/admin/menu/page.tsx`, change item query from `.order('created_at', { ascending: true })` to `.order('display_order', { ascending: true })`

- [x] Task 5: Implement drag-and-drop in `MenuItemList.tsx` (AC: 1, 3)
  - [x] **First**: install `@dnd-kit/core` and `@dnd-kit/sortable` — `npm install @dnd-kit/core @dnd-kit/sortable`
  - [x] Refactor `ItemRow` to use `useSortable` hook; add `GripVertical` drag handle (from `lucide-react`, already installed)
  - [x] Wrap each category section's item list in `<DndContext collisionDetection={closestCenter}>` + `<SortableContext strategy={verticalListSortingStrategy}>`
  - [x] Implement `handleDragEnd`: compute new `display_order` values via `arrayMove`, optimistically update `localItems`, call `reorderMenuItems`, rollback + set `reorderError` on failure
  - [x] Add `reorderError` state; render inline below the affected category's items
  - [x] Update `tests/unit/menu/MenuItemList.test.tsx`: add `display_order` to fixtures, add `reorderMenuItems` to action mock, add drag handle render tests

## Dev Notes

### New Dependency — @dnd-kit (Install Before Implementing Task 5)

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

`@dnd-kit` is the standard DnD library for React 18+/19. It supports mouse, touch (mobile), and keyboard accessibility. It is **NOT currently in `package.json`** — install it before writing any DnD code.

Why @dnd-kit over alternatives:
- Works with React 19 (react-beautiful-dnd does not)
- Supports touch events on mobile (HTML5 DnD API does not reliably)
- Accessible keyboard support (WCAG 2.1 AA — required per architecture)
- No deprecated browser API usage

### DB Migration — Full SQL

```sql
-- supabase/migrations/20260517100000_add_menu_item_display_order.sql

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
```

Apply via Supabase MCP `apply_migration`. The `IF NOT EXISTS` guard makes it safe to re-run.

### TypeScript Types — Exact Changes

In `types/app.ts`, after `image_url: string | null`:

```typescript
export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  is_published: boolean
  image_url: string | null
  display_order: number           // ← ADD THIS
  variants: VariantGroup[]
  availability_schedule: AvailabilitySchedule | null
  created_at: string
}

export interface MenuItemUpdate {
  name?: string
  description?: string | null
  price_cents?: number
  category_id?: string | null
  image_url?: string | null
  display_order?: number          // ← ADD THIS
  variants?: VariantGroup[]
  availability_schedule?: AvailabilitySchedule | null
}
```

`MenuItemCreate` does NOT get `display_order` — the action computes it.

### reorderMenuItems — Exact Implementation

Add to `actions/menuActions.ts`:

```typescript
export async function reorderMenuItems(
  updates: { id: string; display_order: number }[]
): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const results = await Promise.all(
    updates.map(({ id, display_order }) =>
      supabase
        .from('menu_items')
        .update({ display_order })
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
    )
  )

  const firstError = results.find((r) => r.error)?.error
  if (firstError) return { success: false, error: firstError.message }
  return { success: true, data: undefined }
}
```

**Why individual updates not upsert:** Each `.eq('restaurant_id', restaurantId)` ensures RLS — owner can only update their own items. A bulk upsert bypasses per-row checks.

**Partial failure:** If one update in `Promise.all` fails after others succeed, the DB is in a partially reordered state. UI rollback shows the error; owner can retry. Full atomicity via `rpc()` is post-MVP.

### createMenuItem — Append New Items at End of Category

Update `createMenuItem` in `actions/menuActions.ts`. Add a MAX+1 query before the insert (same pattern as `createCategory`):

```typescript
export async function createMenuItem(data: MenuItemCreate): Promise<ActionResult<{ item: MenuItem }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  // Compute display_order = MAX + 1 for this category (or uncategorized)
  const orderQuery = supabase
    .from('menu_items')
    .select('display_order')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Scope to same category — NULL category_id needs special handling
  if (data.category_id) {
    orderQuery.eq('category_id', data.category_id)
  } else {
    orderQuery.is('category_id', null)
  }

  // NOTE: Supabase chain builder — filters must be added to the chain object before awaiting
  // The actual pattern: build the query, then add eq/is, then await
  // See createCategory in actions/menuActions.ts:36 for the simpler (no category filter) version

  const { data: maxRow } = await orderQuery
  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const { data: row, error } = await supabase
    .from('menu_items')
    .insert({ ...data, restaurant_id: restaurantId, display_order: nextOrder })
    .select()
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Failed to create item' }
  return { success: true, data: { item: toMenuItem(row) } }
}
```

**IMPORTANT: Supabase chaining gotcha** — Supabase's query builder is a fluent chain. You cannot do `const q = supabase.from(...); if (x) q.eq(...)` where `q` is unused after the conditional. The chain returns a new builder each time. Either build conditionally inline or use a different approach:

```typescript
// Correct pattern: build the full query inline with conditional filter
const query = data.category_id
  ? supabase.from('menu_items').select('display_order').eq('restaurant_id', restaurantId).eq('category_id', data.category_id).order('display_order', { ascending: false }).limit(1).maybeSingle()
  : supabase.from('menu_items').select('display_order').eq('restaurant_id', restaurantId).is('category_id', null).order('display_order', { ascending: false }).limit(1).maybeSingle()

const { data: maxRow } = await query
const nextOrder = (maxRow?.display_order ?? -1) + 1
```

### MenuItemList — DnD Implementation Pattern

**Full import block for `MenuItemList.tsx`:**
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { reorderMenuItems } from '@/actions/menuActions'
```

**SortableItemRow — replace ItemRow:**
```typescript
function SortableItemRow({ item, onDeleteClick }: ItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li ref={setNodeRef} style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3">
      <button type="button" {...attributes} {...listeners}
        aria-label={`Drag to reorder ${item.name}`}
        className="cursor-grab text-text-tertiary active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      {/* rest of row: name, price, Edit link, Delete button — same as current ItemRow */}
    </li>
  )
}
```

**CategorySection — add DndContext + SortableContext:**
```typescript
function CategorySection({ categoryId, categoryName, sectionItems, onDeleteClick, onDragEnd }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-secondary">{categoryName}</h3>
      {sectionItems.length === 0 ? (
        /* empty state unchanged */
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={(event) => onDragEnd(event, categoryId)}>
          <SortableContext items={sectionItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {sectionItems.map((item) => (
                <SortableItemRow key={item.id} item={item} onDeleteClick={onDeleteClick} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {/* Add item link unchanged */}
    </div>
  )
}
```

**handleDragEnd in MenuItemList — with optimistic update + rollback:**
```typescript
const [reorderError, setReorderError] = useState<string | null>(null)

const handleDragEnd = async (event: DragEndEvent, categoryId: string | null) => {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const categoryItems = localItems
    .filter((i) => i.category_id === categoryId)
    .sort((a, b) => a.display_order - b.display_order)

  const oldIndex = categoryItems.findIndex((i) => i.id === active.id)
  const newIndex = categoryItems.findIndex((i) => i.id === over.id)
  if (oldIndex === -1 || newIndex === -1) return

  const reordered = arrayMove(categoryItems, oldIndex, newIndex)
  const updates = reordered.map((item, idx) => ({ id: item.id, display_order: idx }))

  // Optimistic update
  const previousItems = localItems
  setLocalItems((prev) => {
    const others = prev.filter((i) => i.category_id !== categoryId)
    return [...others, ...reordered.map((item, idx) => ({ ...item, display_order: idx }))]
  })
  setReorderError(null)

  const result = await reorderMenuItems(updates)
  if (!result.success) {
    setLocalItems(previousItems)  // rollback
    setReorderError(result.error)
  }
}
```

**reorderError display** — render below each CategorySection's item list (or once at the top of MenuItemList — pick one consistent location). Per UX spec: no toasts, inline persistent error only.

### MenuPage Query Change — Exact Line

`app/admin/menu/page.tsx` line 10:
```typescript
// Change from:
supabase.from('menu_items').select('*').order('created_at', { ascending: true }),
// To:
supabase.from('menu_items').select('*').order('display_order', { ascending: true }),
```

### Testing — menuActions.reorder.test.ts Pattern

The `reorderMenuItems` action ends each update call chain with `.eq()` (no `.single()`). The mock chain must be thenable (awaitable via `Promise.all`). Key difference from other action tests:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { reorderMenuItems } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'

// The update chain ends with .eq() and is directly awaited via Promise.all.
// The chain must resolve to { error: null | Error } — NOT return 'this'.
function makeUpdateChain(error: null | { message: string } = null) {
  const resolvedValue = { data: null, error }
  // Create a chain where the final .eq() returns a Promise
  const chain: Record<string, unknown> = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  }
  // First .eq() returns this, second .eq() returns a resolved Promise
  let eqCallCount = 0
  ;(chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
    eqCallCount++
    return eqCallCount < 2 ? chain : Promise.resolve(resolvedValue)
  })
  return chain
}

// Test cases to cover:
// - returns { success: false, error: 'Not authenticated' } when no user
// - returns { success: false, error: 'No restaurant' } when no restaurantId
// - calls supabase.update with { display_order } for each item
// - calls supabase.eq('id', id) and eq('restaurant_id', restaurantId) per item
// - returns { success: true } when all updates succeed
// - returns { success: false, error: ... } when any update fails
```

**Existing `MenuItemList.test.tsx` — fixture updates needed:**

Add `display_order` to all item fixture objects:
```typescript
const items = [
  { id: 'item-1', ..., display_order: 0, variants: [], availability_schedule: null, created_at: '2026-05-10' },
  { id: 'item-2', ..., display_order: 1, variants: [], availability_schedule: null, created_at: '2026-05-10' },
]
```

Add `reorderMenuItems` to the `menuActions` mock at the top:
```typescript
vi.mock('@/actions/menuActions', () => ({
  deleteMenuItem: vi.fn(),
  reorderMenuItems: vi.fn(),
}))
```

Add new tests:
- `renders drag handle for each item` — `screen.getByLabelText('Drag to reorder Soup')` is defined
- `reorderMenuItems is called after drag` — testing full DnD interaction in jsdom is complex; use @dnd-kit test utilities or skip drag simulation, just verify the mock is available

All 9 existing tests must continue to pass — check `itemsByCategory` sort logic still works with `display_order`.

### itemsByCategory Sort — Critical

`MenuItemList` currently uses:
```typescript
acc[cat.id] = localItems.filter((i) => i.category_id === cat.id)
```

After adding `display_order`, items in each category must be sorted by `display_order` for the initial render to be correct (server already returns them sorted, but after optimistic updates the local state may be unsorted):
```typescript
acc[cat.id] = localItems
  .filter((i) => i.category_id === cat.id)
  .sort((a, b) => a.display_order - b.display_order)
```

Apply same sort to `uncategorized`:
```typescript
const uncategorized = localItems
  .filter((i) => i.category_id === null)
  .sort((a, b) => a.display_order - b.display_order)
```

### Architecture Alignment

The architecture directory map says `CategoryManager.tsx ← [FR9, FR12]` — this was the planned location for item reordering. **Do NOT put item DnD in CategoryManager.** The actual code has `CategoryManager` handle category CRUD only, and `MenuItemList` handle item display + delete. Item reordering belongs in `MenuItemList` — that's where the item list renders.

### Supabase Import Path (Critical)

Architecture doc says `utils/supabase/` but actual code uses:
- Server Actions → `import { createClient } from '@/lib/supabase/server'`
- Admin actions → `import { createAdminClient } from '@/lib/supabase/admin'`

### What This Story Does NOT Change

- `CategoryManager.tsx` — category reordering is out of scope for this story
- `components/admin/MenuItemForm.tsx` — item edit page unaffected
- `components/admin/AvailabilitySchedule.tsx`, `VariantEditor.tsx` — unaffected
- Cross-category item movement — items can only drag within their category; cross-category is not in scope
- Customer-facing menu rendering — Story 4.2 reads items `ORDER BY display_order`; this story provides the column and data

### References

- `actions/menuActions.ts:36` — `createCategory` MAX+1 display_order pattern to mirror for `createMenuItem`
- `components/admin/MenuItemList.tsx` — primary file being modified; read in full before changes
- `app/admin/menu/page.tsx:10` — item query to update from `created_at` to `display_order`
- `tests/unit/menu/menuActions.item.test.ts` — mock pattern to follow for `menuActions.reorder.test.ts`
- `tests/unit/menu/MenuItemList.test.tsx` — file to update; all 9 existing tests must pass
- Story 2.4 dev notes — previous story patterns: `_bmad-output/implementation-artifacts/2-4-item-availability-scheduling.md`
- @dnd-kit sortable docs: https://dndkit.com/docs/sortable

### Review Findings

- [x] [Review][Patch] `reorderError` displayed on ALL category sections on failure — AC3 requires error only in the affected category section [components/admin/MenuItemList.tsx]
- [x] [Review][Patch] `createMenuItem` MAX query error silently swallowed — DB/network failure falls back to `display_order: 0`, silently colliding with existing items [actions/menuActions.ts]
- [x] [Review][Defer] TOCTOU race on `display_order` in `createMenuItem` — two concurrent creates for same category can receive duplicate order values [actions/menuActions.ts] — deferred, explicitly post-MVP per story dev notes
- [x] [Review][Defer] Non-atomic `reorderMenuItems` batch — `Promise.all` partial failure leaves DB in mixed old/new state [actions/menuActions.ts] — deferred, explicitly post-MVP per story dev notes
- [x] [Review][Defer] No max-length guard on `updates` array — unbounded `Promise.all` fan-out for authenticated DoS [actions/menuActions.ts] — deferred, pre-existing server action pattern
- [x] [Review][Defer] Stale `previousItems` snapshot during concurrent overlapping drags — rollback restores wrong baseline [components/admin/MenuItemList.tsx] — deferred, extremely unlikely UX scenario
- [x] [Review][Defer] Migration `ROW_NUMBER` non-deterministic for items sharing identical `created_at` timestamp [supabase/migrations/20260517100000_add_menu_item_display_order.sql] — deferred, low impact
- [x] [Review][Defer] `arrayMove` on a 1-item category fires a redundant `reorderMenuItems` server call [components/admin/MenuItemList.tsx] — deferred, harmless

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Test failures fixed: `makeChain` in `menuActions.item.test.ts` was missing `.is()` method needed by the new null-category branch in `createMenuItem`. Fixed by adding `.is: vi.fn().mockReturnThis()`.
- Test failures fixed: `makeUpdateChain` in reorder test shared a single `eqCallCount` across `Promise.all` items; replaced with a per-call factory pattern (`makeUpdateChainFactory`) so each `from('menu_items')` call gets its own counter.

### Completion Notes List

- Task 1: Migration `20260517100000_add_menu_item_display_order.sql` created and applied via Supabase MCP. Adds `display_order integer NOT NULL DEFAULT 0` and backfills existing rows with sequential values per category ordered by `created_at`.
- Task 2: Added `display_order: number` to `MenuItem` and `display_order?: number` to `MenuItemUpdate` in `types/app.ts`. `MenuItemCreate` intentionally unchanged.
- Task 3: Added `reorderMenuItems` server action (individual updates with `restaurant_id` guard per row). Updated `createMenuItem` to compute `MAX(display_order)+1` per category before insert, using conditional query for null/non-null `category_id`. 5 unit tests in `menuActions.reorder.test.ts` all pass.
- Task 4: Changed `MenuPage` item query from `.order('created_at')` to `.order('display_order')`.
- Task 5: Installed `@dnd-kit/core` and `@dnd-kit/sortable`. Replaced `ItemRow` with `SortableItemRow` (uses `useSortable`, `GripVertical` handle). `CategorySection` now wraps item list in `DndContext`+`SortableContext`. `handleDragEnd` does optimistic update + rollback on failure. `reorderError` renders inline below the category list. Updated `MenuItemList.test.tsx` with `display_order` fixtures, `reorderMenuItems` mock, and drag handle render tests. All 132 tests pass.

### File List

- `supabase/migrations/20260517100000_add_menu_item_display_order.sql` (new)
- `types/app.ts` (modified)
- `actions/menuActions.ts` (modified)
- `app/admin/menu/page.tsx` (modified)
- `components/admin/MenuItemList.tsx` (modified)
- `tests/unit/menu/menuActions.reorder.test.ts` (new)
- `tests/unit/menu/menuActions.item.test.ts` (modified — added `.is` to makeChain)
- `tests/unit/menu/MenuItemList.test.tsx` (modified — fixtures, mock, drag handle tests)

### Change Log

- Added `display_order` column to `menu_items` table with sequential backfill (2026-05-16)
- Added `reorderMenuItems` server action and updated `createMenuItem` for MAX+1 ordering (2026-05-16)
- Implemented drag-and-drop item reordering with optimistic UI and error rollback in `MenuItemList.tsx` (2026-05-16)
