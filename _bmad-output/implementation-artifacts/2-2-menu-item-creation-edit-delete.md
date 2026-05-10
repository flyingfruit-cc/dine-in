# Story 2.2: Menu Item Creation, Edit & Delete

Status: done

## Story

As a restaurant owner,
I want to create, edit, and delete menu items with name, description, price, and image,
So that my menu reflects my actual offerings with all the detail customers need.

## Acceptance Criteria

**AC1** — New item form:
Given an authenticated owner is on `/admin/menu/new`
When the page renders
Then they see fields for: name (required), description, price (currency-prefixed numeric input), image upload, and a category selector showing their existing categories

**AC2** — Auto-save:
Given an owner fills in item fields and stops typing for 2 seconds
When the auto-save debounce fires
Then the item is saved/updated via `menuActions.ts` and a silent indicator confirms success

**AC3** — Image upload:
Given an owner selects an image (drag-and-drop desktop / tap-to-select mobile)
When an image is selected
Then a preview is shown immediately before upload
And on save the image is uploaded to Supabase Storage at `{restaurant_id}/{item_id}/image` via Server Action and served via CDN

**AC4** — Price storage:
Given an owner enters a price
When saved
Then it is stored as `price_cents: integer` and displayed as a formatted currency string via `utils/formatPrice.ts`

**AC5** — Delete:
Given an owner triggers item delete from the menu page
When the destructive confirmation dialog is confirmed
Then the item is removed from `menu_items` and no longer appears in the builder

**AC6** — Server Action error:
Given a Server Action fails during save
When the error is returned
Then an inline error ("Unable to save — tap to try again") is shown and form data is preserved

**AC7** — Edit existing item:
Given an owner navigates to an existing item at `/admin/menu/[item_id]`
When the item form renders
Then all existing field values (name, description, price, image, category) are pre-populated and the auto-save mechanism applies to any changes

**AC8** — Post-create navigation CTAs:
Given an owner is on the edit page `/admin/menu/[item_id]`
When the page renders
Then they see two navigation links: "Add another item →" (linking to `/admin/menu/new`) and "Back to menu" (linking to `/admin/menu`)

**AC9** — Image removal:
Given an owner has an image on the item (newly uploaded or pre-existing)
When they click "Remove image"
Then the preview is cleared immediately
And on the next auto-save the item's `image_url` is set to null in the database
And the storage object is not deleted (orphan cleanup is deferred)

## Tasks / Subtasks

- [x] Task 1: Create `utils/formatPrice.ts` and add `MenuItem` type to `types/app.ts` (AC: 4)
  - [x] Create `utils/formatPrice.ts` — `export function formatPrice(priceCents: number): string` returns `"$15.00"` format
  - [x] Add `MenuItem` interface to `types/app.ts` (see schema in Dev Notes)
  - [x] Write unit tests in `tests/unit/utils/formatPrice.test.ts`

- [x] Task 2: Apply `image_url` column migration (AC: 3)
  - [x] Create `supabase/migrations/20260510120000_add_menu_item_image_url.sql` with `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text`
  - [x] Apply via Supabase MCP `apply_migration` tool

- [x] Task 3: Add menu item Server Actions to `actions/menuActions.ts` (AC: 2, 3, 4, 5, 6)
  - [x] `createMenuItem(data: MenuItemCreate): Promise<ActionResult<{ item: MenuItem }>>` — INSERT scoped to owner's restaurantId
  - [x] `updateMenuItem(itemId: string, data: MenuItemUpdate): Promise<ActionResult<{ item: MenuItem }>>` — UPDATE scoped to owner's restaurant
  - [x] `deleteMenuItem(itemId: string): Promise<ActionResult<void>>` — DELETE scoped to owner's restaurant
  - [x] `uploadMenuItemImage(itemId: string, formData: FormData): Promise<ActionResult<{ imageUrl: string }>>` — upload to Storage via admin client, update `image_url` on item, return public URL
  - [x] Unit tests in `tests/unit/menu/menuActions.item.test.ts`

- [x] Task 4: Create `components/admin/MenuItemForm.tsx` Client Component (AC: 1, 2, 3, 4, 6, 7)
  - [x] Props: `categories: Category[]`, `item?: MenuItem` (absent = create mode)
  - [x] Auto-save debounced 2s — fires when `name` is non-empty; uses `useRef` for timer to avoid stale closures
  - [x] Price field: `<input type="number" inputMode="decimal">` with "$" prefix span; stores internally as `priceCents` integer
  - [x] Image field: `<input type="file" accept="image/*">` with drag-and-drop wrapper; preview via `URL.createObjectURL`; pending file uploaded on next auto-save after `itemId` is known
  - [x] Category: `<select>` from categories prop with "No category" unassigned option
  - [x] Save indicator: shows "Saving…" → "Saved ✓" (2s) or inline error on failure
  - [x] Create flow: first auto-save calls `createMenuItem`, stores returned itemId in ref; subsequent saves call `updateMenuItem`
  - [x] Unit tests in `tests/unit/menu/MenuItemForm.test.tsx`

- [x] Task 5: Create `app/admin/menu/new/page.tsx` Server Component (AC: 1)
  - [x] Fetch categories ordered by `display_order ASC`
  - [x] Render `<MenuItemForm categories={categories} />`

- [x] Task 6: Create `app/admin/menu/[item_id]/page.tsx` Server Component (AC: 7)
  - [x] Fetch item by `item_id` param (use `params.item_id` from Next.js dynamic route)
  - [x] Fetch categories ordered by `display_order ASC`
  - [x] If item not found → `notFound()` from `next/navigation`
  - [x] Render `<MenuItemForm item={item} categories={categories} />`

- [x] Task 7: Create `components/admin/MenuItemList.tsx` and update `app/admin/menu/page.tsx` (AC: 5)
  - [x] `MenuItemList`: props `categories: Category[]`, `items: MenuItem[]`; groups items by `category_id`; shows per-category item rows with name, formatted price, edit link to `/admin/menu/[id]`, delete button
  - [x] Delete: destructive confirmation dialog (same pattern as `CategoryManager`); calls `deleteMenuItem`; removes item from local state on success; shows inline error on failure
  - [x] "Add item →" link below each category's list pointing to `/admin/menu/new`
  - [x] Empty state per category: "Add your first item →"
  - [x] Uncategorized items shown at bottom under "Uncategorized" heading (if any)
  - [x] Update `app/admin/menu/page.tsx`: fetch `menu_items` ordered by `created_at ASC`; pass to `<MenuItemList>`
  - [x] Unit tests in `tests/unit/menu/MenuItemList.test.tsx`

- [x] Task 8: Add post-create CTAs and image removal to `MenuItemForm.tsx` (AC: 8, 9)
  - [x] Add "Add another item →" and "Back to menu" links below the save status indicator (edit mode only — both links always visible on `/admin/menu/[item_id]`)
  - [x] Add `imageRemoved` boolean state; when true, include `image_url: null` in the next `updateMenuItem` call
  - [x] Add "Remove image" button shown when `imagePreview` is non-null; clears preview, clears pending file, sets `imageRemoved = true`, revokes blob URL if applicable
  - [x] Reset `imageRemoved` to false after successful save
  - [x] Unit tests for new behaviour in `tests/unit/menu/MenuItemForm.test.tsx`

### Review Findings

- [x] [Review][Decision] Post-create navigation — resolved: redirect to `/admin/menu/[id]` after first successful create via `router.push`.

- [x] [Review][Patch] `uploadMenuItemImage` ignores DB update result — the `.update({ image_url })` result is never checked; a DB failure is silently swallowed while the action returns success with a URL that was never persisted [actions/menuActions.ts:uploadMenuItemImage]
- [x] [Review][Patch] Image upload failure not surfaced in UI — when `uploadMenuItemImage` returns `{ success: false }`, `doSave` continues to show "Saved ✓"; user has no indication the image was not stored [components/admin/MenuItemForm.tsx:doSave]
- [x] [Review][Patch] Save error shows raw server message — the `createMenuItem`/`updateMenuItem` failure branches call `setSaveError(result.error)` (raw server error), while AC6 requires the fixed copy `"Unable to save — tap to try again"` [components/admin/MenuItemForm.tsx:doSave]
- [x] [Review][Patch] `pendingImageFile` not in `useEffect` deps — if user selects an image after the last text change and makes no further text changes, the image is never uploaded because no new debounce fires [components/admin/MenuItemForm.tsx:useEffect]
- [x] [Review][Patch] Old timer not cleared when name is emptied — the `useEffect` returns early before `clearTimeout` when `name.trim()` is empty, leaving a stale timer that fires `doSave` with the previous non-empty name [components/admin/MenuItemForm.tsx:useEffect]
- [x] [Review][Patch] Object URL memory leak — `URL.revokeObjectURL` is never called on the previous blob URL before `URL.createObjectURL` is called for a new image [components/admin/MenuItemForm.tsx:handleImageChange+handleDrop]
- [x] [Review][Patch] No server-side MIME type validation — `uploadMenuItemImage` accepts any file type; should guard `if (!file.type.startsWith('image/'))` [actions/menuActions.ts:uploadMenuItemImage]
- [x] [Review][Patch] No server-side file size validation — `uploadMenuItemImage` has no size cap; should guard against files exceeding 5 MB [actions/menuActions.ts:uploadMenuItemImage]
- [x] [Review][Patch] No client-side MIME type check in `handleImageChange` — `handleDrop` checks `file.type.startsWith('image/')` but `handleImageChange` does not, inconsistent defence-in-depth [components/admin/MenuItemForm.tsx:handleImageChange]
- [x] [Review][Patch] `ItemRow` and `CategorySection` are inline components — both defined inside `MenuItemList` body; React unmounts and remounts them on every parent render instead of reconciling [components/admin/MenuItemList.tsx]

- [x] [Review][Defer] `formatPrice` does not handle negative values — deferred, prices are never negative in domain; pre-existing type-widening concern
- [x] [Review][Defer] `deleteMenuItem` returns success for no-op delete — deferred, RLS scoping means this can't be triggered in production; pre-existing pattern
- [x] [Review][Defer] `localItems` not synced with refreshed `items` prop — deferred, architectural limitation of client-only state; no page revalidation mechanism in scope
- [x] [Review][Defer] `MenuItem.updated_at` absent from type — deferred, field not in current schema; add when needed
- [x] [Review][Defer] `MenuItemUpdate` allows empty-object no-op — deferred, TypeScript nicety; not a functional bug
- [x] [Review][Defer] Edit page authorization relies solely on RLS — deferred, spec-acknowledged pattern; add `restaurant_id` filter as defence-in-depth in a future story

## Dev Notes

### PREREQUISITE: Storage Bucket — Manual Step Before Image Upload

Supabase Storage bucket `menu-images` must be created **before** the image upload code runs. This cannot be done via SQL migration — do it manually:

1. Supabase Dashboard → Storage → New bucket
2. Name: `menu-images`
3. Public: ✓ (menu item photos served via CDN without auth)

Uploads use the admin client (service role), so no Storage RLS policies are required.

### PREREQUISITE: image_url Column Migration

`menu_items` currently has no `image_url` column. Apply migration first (Task 2) before writing any code that reads or writes `image_url`. Migration file:

```sql
-- supabase/migrations/20260510120000_add_menu_item_image_url.sql
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text;
```

### Supabase Import Path

Architecture doc says `utils/supabase/` — **ignore this**. Actual codebase uses `lib/supabase/`:
- Server Actions (regular) → `import { createClient } from '@/lib/supabase/server'`
- Server Actions (storage upload) → `import { createAdminClient } from '@/lib/supabase/admin'`
- Client Components → `import { createClient } from '@/lib/supabase/client'`

### menu_items Table Schema (after migration)

```sql
CREATE TABLE public.menu_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id   uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text,
  price_cents   integer     NOT NULL DEFAULT 0,
  is_published  boolean     DEFAULT false NOT NULL,
  image_url     text,        -- added by Story 2.2 migration
  created_at    timestamptz DEFAULT now() NOT NULL
);
```

Generated TypeScript type (`types/supabase.ts` — DO NOT EDIT) after migration will include `image_url: string | null`.

`MenuItem` interface to add to `types/app.ts`:
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
  created_at: string
}
```

### formatPrice Utility

```typescript
// utils/formatPrice.ts
export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`
}
```

`formatPrice(1500)` → `"$15.00"`, `formatPrice(0)` → `"$0.00"`, `formatPrice(99)` → `"$0.99"`.
File goes in `utils/formatPrice.ts` — NOT in `lib/`.

### getAuthContext — Use Existing Helper, Don't Re-implement

`getAuthContext()` is already defined (not exported) in `actions/menuActions.ts`. Add all new menu item actions to the **same file** — the helper is already available. Do not duplicate or re-import it.

### Server Actions Input Types

Add to `types/app.ts`:
```typescript
export interface MenuItemCreate {
  name: string
  description?: string | null
  price_cents: number
  category_id?: string | null
}

export interface MenuItemUpdate {
  name?: string
  description?: string | null
  price_cents?: number
  category_id?: string | null
}
```

### createMenuItem / updateMenuItem Pattern

```typescript
export async function createMenuItem(
  data: MenuItemCreate
): Promise<ActionResult<{ item: MenuItem }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { data: row, error } = await supabase
    .from('menu_items')
    .insert({ ...data, restaurant_id: restaurantId })
    .select()
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Failed to create item' }
  return { success: true, data: { item: row as MenuItem } }
}
```

`updateMenuItem` is the same shape but uses `.update().eq('id', itemId).eq('restaurant_id', restaurantId)`.

### uploadMenuItemImage Pattern

```typescript
export async function uploadMenuItemImage(
  itemId: string,
  formData: FormData
): Promise<ActionResult<{ imageUrl: string }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided' }

  const buffer = await file.arrayBuffer()
  const storagePath = `${restaurantId}/${itemId}/image`

  const adminClient = createAdminClient()
  const { error: uploadError } = await adminClient.storage
    .from('menu-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { success: false, error: uploadError.message }

  const { data: { publicUrl } } = adminClient.storage
    .from('menu-images')
    .getPublicUrl(storagePath)

  // Update image_url on the item using the regular client (owner RLS covers UPDATE)
  await supabase
    .from('menu_items')
    .update({ image_url: publicUrl })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  return { success: true, data: { imageUrl: publicUrl } }
}
```

### Auto-Save Implementation in MenuItemForm

```typescript
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const savedItemIdRef = useRef<string | null>(item?.id ?? null)

// Trigger auto-save when text fields change
useEffect(() => {
  if (!name.trim()) return
  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => { void doSave() }, 2000)
  return () => { if (timerRef.current) clearTimeout(timerRef.current) }
}, [name, description, priceCents, categoryId])
```

`doSave()`:
1. If `savedItemIdRef.current` is null → call `createMenuItem`, set ref to returned `item.id`
2. Else → call `updateMenuItem(savedItemIdRef.current, data)`
3. If `pendingImageFile` is set AND item ID is known → call `uploadMenuItemImage`, update `imageUrl` state, clear `pendingImageFile`
4. On success: `setSaveStatus('saved')`, reset to `'idle'` after 2s
5. On error: `setSaveStatus('error')`, `setSaveError(result.error)`
6. Wrap in try/catch for network errors: `setSaveError('Unable to save — tap to try again')`

Use `useRef` (not `useState`) for `savedItemIdRef` and `timerRef` to avoid stale closures and unnecessary re-renders.

### Price Input Implementation

```tsx
<div className="flex items-center gap-1">
  <span className="text-sm text-text-secondary">$</span>
  <input
    type="number"
    inputMode="decimal"
    min="0"
    step="0.01"
    value={(priceCents / 100).toFixed(2)}
    onChange={(e) => setPriceCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
    className="..."
  />
</div>
```

### RLS on menu_items

`owner_all_menu_items` policy (migration `20260509144631_rls_policies.sql`) covers ALL operations (SELECT/INSERT/UPDATE/DELETE) for authenticated restaurant owners scoped to their restaurant. No admin client needed for CRUD — only for Storage uploads.

### app/admin/menu/page.tsx — Update Items Fetch

Current page fetches only categories. Add items fetch:

```typescript
const [{ data: categories }, { data: items }] = await Promise.all([
  supabase.from('categories').select('*').order('display_order', { ascending: true }),
  supabase.from('menu_items').select('*').order('created_at', { ascending: true }),
])
```

Then pass both to components:
```tsx
<CategoryManager initialCategories={categories ?? []} />
<MenuItemList categories={categories ?? []} items={items ?? []} />
```

### MenuItemList: Grouping Items by Category

```typescript
const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
  acc[cat.id] = items.filter((i) => i.category_id === cat.id)
  return acc
}, {})
const uncategorized = items.filter((i) => i.category_id === null)
```

Render each category's items below the category name. Show "Add item →" as a link to `/admin/menu/new` after each category's item list.

### app/admin/menu/[item_id]/page.tsx — Dynamic Route Params

In Next.js 15 App Router, dynamic params are passed as `props.params` which is a Promise — use `await`:

```typescript
export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ item_id: string }>
}) {
  const { item_id } = await params
  const supabase = await createClient()
  // ...
  const { data: item } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', item_id)
    .single()

  if (!item) notFound()
  // ...
}
```

Note: RLS scopes the query to the authenticated owner's restaurant — no explicit `restaurant_id` filter needed on the read (though it's good practice to add it as defense-in-depth).

### UX Rules (from spec)

- **No toasts** — inline errors only
- **Destructive confirmation dialog** for delete — copy: "Delete [item name]?" + "This will permanently delete this menu item." + Cancel + "Delete item" (red)
- **Auto-save indicator**: subtle text "Saving…" / "Saved ✓" below the form — never a spinner blocking the form
- **Image upload**: drag-and-drop on desktop (handle `dragover`/`drop` events), tap-to-select on mobile (`<input type="file">` works for both); preview shown immediately via `URL.createObjectURL`
- **Empty state per category**: "Add your first item →" — same style as empty state in `CategoryManager`
- **Error copy must be actionable**: "Unable to save — tap to try again"
- Admin menu builder is desktop-primary; mobile still works

### display_order on menu_items

The `menu_items` table has NO `display_order` column — that is added in Story 2.5. For Story 2.2, order items by `created_at ASC`. Do NOT add a `display_order` column to this migration.

### is_published on menu_items

Items are draft (`is_published = false`) by default. The publish flow is Story 2.7. Do NOT set or display `is_published` in this story.

### What This Story Does NOT Change

- `CategoryManager.tsx` — do NOT modify; item listing is in new `MenuItemList` component
- `OnboardingChecklist.tsx` — "Add menu items" step stays hardcoded `false`; wired in Story 2.7
- Variants (`VariantEditor`) — Story 2.3 scope
- Availability (`AvailabilitySchedule`) — Story 2.4 scope
- Item reordering — Story 2.5 scope
- Menu preview (`MenuPreview`) — Story 2.6 scope
- Publish/offline control — Story 2.7 scope

### Testing: Server Actions in Vitest Node Environment

Same pattern as `tests/unit/menu/menuActions.test.ts`:
```typescript
// @vitest-environment node
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
// imports AFTER mocks
import { createMenuItem, updateMenuItem, deleteMenuItem, uploadMenuItemImage } from '@/actions/menuActions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
```

For `uploadMenuItemImage`, mock the admin client storage chain:
```typescript
const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/img' } })
vi.mocked(createAdminClient).mockReturnValue({
  storage: {
    from: vi.fn().mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
  },
} as any)
```

### References

- menu_items schema: `supabase/migrations/20260509144558_initial_schema.sql`
- RLS policies: `supabase/migrations/20260509144631_rls_policies.sql`
- Existing Server Action pattern: `actions/menuActions.ts`
- Admin client: `lib/supabase/admin.ts`
- `ActionResult<T>` type: `types/app.ts`
- CategoryManager (delete dialog pattern): `components/admin/CategoryManager.tsx`
- Admin layout (auth guard): `app/admin/layout.tsx`
- UX spec sections "Form Patterns", "Modal and Overlay Patterns": `_bmad-output/planning-artifacts/ux-design-specification.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `vi.useFakeTimers()` + `waitFor` hangs: RTL's waitFor polls via setInterval which is frozen by fake timers. Fix: use `vi.runAllTimersAsync()` inside `act` instead of `waitFor`, or check directly after advancing time.
- Transient "saving" state not catchable in tests: `act(async () => { advanceTimersByTime })` drains microtasks so mock resolves before we can check "Saving…". Tested "Saved ✓" instead (stable end state).
- `URL.createObjectURL` not in jsdom: must mock globally with `global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')`.

### Completion Notes List

- All 8 tasks complete + all 10 patch findings from code review resolved. 83 tests passing, zero regressions.
- formatPrice utility + MenuItem/MenuItemCreate/MenuItemUpdate types added to types/app.ts.
- image_url column migration applied to Supabase project zvdytoylyfcvwsgmvjye. Storage bucket menu-images (public, 5MB) created.
- createMenuItem/updateMenuItem/deleteMenuItem/uploadMenuItemImage added to menuActions.ts using existing getAuthContext() helper.
- MenuItemForm: auto-save debounce 2s, create/edit mode via savedItemIdRef, image drag-and-drop + preview, inline save feedback.
- app/admin/menu/new/page.tsx and app/admin/menu/[item_id]/page.tsx Server Components created.
- MenuItemList: groups items by category, delete dialog pattern from CategoryManager, uncategorized section.
- app/admin/menu/page.tsx updated to fetch items in parallel and render MenuItemList.

### File List

- utils/formatPrice.ts (new)
- types/app.ts (modified — MenuItem, MenuItemCreate, MenuItemUpdate)
- supabase/migrations/20260510120000_add_menu_item_image_url.sql (new)
- actions/menuActions.ts (modified — createMenuItem, updateMenuItem, deleteMenuItem, uploadMenuItemImage)
- components/admin/MenuItemForm.tsx (new)
- app/admin/menu/new/page.tsx (new)
- app/admin/menu/[item_id]/page.tsx (new)
- components/admin/MenuItemList.tsx (new)
- app/admin/menu/page.tsx (modified)
- tests/unit/utils/formatPrice.test.ts (new)
- tests/unit/menu/menuActions.item.test.ts (new)
- tests/unit/menu/MenuItemForm.test.tsx (new)
- tests/unit/menu/MenuItemList.test.tsx (new)

### Change Log

- 2026-05-10: Story implemented — all tasks complete (Date: 2026-05-10)
- 2026-05-10: Addressed code review findings — 10 patch items resolved + 1 decision (Date: 2026-05-10)
  - P1: DB update result checked in uploadMenuItemImage
  - P2: Image upload failure surfaced in UI with fixed error copy
  - P3: All save error branches use fixed copy "Unable to save — tap to try again"
  - P4: pendingImageFile added to useEffect deps
  - P5: clearTimeout moved before empty name guard
  - P6: URL.revokeObjectURL called before creating new blob URL
  - P7: Server-side MIME type validation added
  - P8: Server-side 5MB file size validation added
  - P9: Client-side MIME type check added to handleImageChange
  - P10: ItemRow and CategorySection moved to module level in MenuItemList
  - D1: Post-create redirect to /admin/menu/[id] via router.push
- 2026-05-10: AC8+AC9 added via correct-course — post-create CTAs and image removal (Date: 2026-05-10)
  - AC8: "Add another item →" and "Back to menu" links shown in edit mode
  - AC9: "Remove image" button clears preview and sets image_url null on next save
  - MenuItemUpdate type extended with image_url field
  - imageRemoved state added to doSave; imageRemoved added to useEffect deps
