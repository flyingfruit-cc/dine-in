# Story 2.3: Item Variants & Pricing

Status: done (reviewed 2026-05-12)

## Story

As a restaurant owner,
I want to define variants for a menu item and set a price per variant,
So that customers can configure items (e.g., size, modifications) and see accurate prices.

## Acceptance Criteria

**AC1** — Add a variant group:
Given an owner is editing a menu item at `/admin/menu/[item_id]`
When they click "Add variant group" in the VariantEditor
Then a new group row appears with an empty name input and an "Add option" button

**AC2** — Add options to a group:
Given an owner has a variant group (e.g., "Size")
When they click "Add option"
Then a new option row appears with an empty name input and a price input
And they can add up to 6 options per group — the "Add option" button is disabled at 6

**AC3** — Price per option:
Given an owner enters a price for a variant option
When the auto-save fires
Then the price is stored as `price_cents: integer` alongside the option in the `variants` JSONB column

**AC4** — Remove a variant option:
Given an owner removes a variant option
When the auto-save fires
Then the option no longer appears in the builder and will not appear on the customer menu

**AC5** — Auto-save integration:
Given an owner makes any change in VariantEditor (add group, rename group, add option, rename option, change price, remove)
When 2 seconds have elapsed since the last change
Then the full variants array is included in the `updateMenuItem` auto-save call alongside the existing text fields

**AC6** — Persist and restore:
Given an owner has saved variants and navigates away then returns to the item
When the edit page renders
Then all variant groups and their options (names and prices) are pre-populated in the VariantEditor

## Tasks / Subtasks

- [x] Task 1: Add DB migration for `variants` column (AC: 3, 4, 6)
  - [x] Create `supabase/migrations/20260511100000_add_menu_item_variants.sql`
  - [x] SQL: `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb NOT NULL;`
  - [x] Apply via Supabase MCP `apply_migration` tool

- [x] Task 2: Extend types in `types/app.ts` (AC: 3, 4, 5, 6)
  - [x] Add `VariantOption` interface: `{ id: string; name: string; price_cents: number }`
  - [x] Add `VariantGroup` interface: `{ id: string; name: string; options: VariantOption[] }`
  - [x] Add `variants?: VariantGroup[]` to `MenuItem`
  - [x] Add `variants?: VariantGroup[]` to `MenuItemCreate`
  - [x] Add `variants?: VariantGroup[]` to `MenuItemUpdate`

- [x] Task 3: Create `components/admin/VariantEditor.tsx` Client Component (AC: 1, 2, 3, 4)
  - [x] Props: `variants: VariantGroup[], onChange: (variants: VariantGroup[]) => void`
  - [x] "Add variant group" button at bottom — appends a new group with `crypto.randomUUID()` id, empty name, empty options
  - [x] Each group row: name input (text, blur-validates non-empty) + remove group button
  - [x] Each option row within group: name input + price input ($ prefix, `inputMode="decimal"`) + remove option button
  - [x] "Add option" button per group — disabled when group already has 6 options
  - [x] All mutations call `onChange` with the new variants array (no local state — controlled component)
  - [x] Write unit tests in `tests/unit/menu/VariantEditor.test.tsx`

- [x] Task 4: Integrate VariantEditor into `components/admin/MenuItemForm.tsx` (AC: 5, 6)
  - [x] Add `variants` state: `useState<VariantGroup[]>(item?.variants ?? [])`
  - [x] Add `variants` to the `doSave()` call: include in `textData` (for `createMenuItem`) and `updateData` (for `updateMenuItem`)
  - [x] Add `variants` to the `useEffect` dependency array so changes trigger the debounce
  - [x] Render `<VariantEditor variants={variants} onChange={setVariants} />` below the Category field
  - [x] Update unit tests in `tests/unit/menu/MenuItemForm.test.tsx`

### Review Findings

- [x] [Review][Patch] Edit-page `[item_id]/page.tsx` casts row to `MenuItem` without `toMenuItem` — `variants` arrives as raw `Json`, bypassing the `?? []` fallback [app/admin/menu/[item_id]/page.tsx]
- [x] [Review][Patch] Test mock `onChange` typed `(v: unknown[]) => void` — use `VariantGroup[]` for type safety [tests/unit/menu/MenuItemForm.test.tsx]
- [x] [Review][Patch] No test verifies `variants` is included in `updateMenuItem` payload — only the `createMenuItem` path is exercised [tests/unit/menu/MenuItemForm.test.tsx]
- [x] [Review][Defer] `toMenuItem` bare `as VariantGroup[]` cast — no shape validation against malformed JSONB [actions/menuActions.ts] — deferred, pre-existing; DB `NOT NULL DEFAULT '[]'` is the real guard
- [x] [Review][Defer] No server-side non-negative validation on `price_cents` for variant options — deferred, pre-existing; client `min="0"` is the guard
- [x] [Review][Defer] No upper bound on number of variant groups (only options capped at 6) — deferred, intentional per spec; product decision
- [x] [Review][Defer] Floating-point rounding error for certain decimal prices (e.g. $2.555) — deferred, pre-existing pattern shared with main item price field [components/admin/VariantEditor.tsx]
- [x] [Review][Defer] Variant-only edits on new items silently discarded by `!name.trim()` guard — deferred, pre-existing design; predates this story [components/admin/MenuItemForm.tsx]

## Dev Notes

### Schema: JSONB on menu_items (not a separate table)

Variants are stored as a JSONB column on `menu_items`, not in a separate relational table. This is intentional — variants are a property of the item, not an independent entity, and JSONB avoids N+1 fetches on the menu builder page.

Migration file:
```sql
-- supabase/migrations/20260511100000_add_menu_item_variants.sql
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb NOT NULL;
```

Apply via Supabase MCP `apply_migration` — same approach as `20260510120000_add_menu_item_image_url.sql`.

After applying, regenerate `types/supabase.ts` if using Supabase MCP type generation. The `variants` column will appear as `variants: Json` in the generated types — cast to `VariantGroup[]` at the app boundary.

### TypeScript Types to Add

```typescript
// types/app.ts — add these:

export interface VariantOption {
  id: string        // client-generated UUID, used as React key
  name: string      // e.g., "Small"
  price_cents: number
}

export interface VariantGroup {
  id: string        // client-generated UUID, used as React key
  name: string      // e.g., "Size"
  options: VariantOption[]
}
```

Then extend existing interfaces:
```typescript
export interface MenuItem {
  // ...existing fields...
  variants: VariantGroup[]   // NOT optional — DB default is '[]'
}

export interface MenuItemCreate {
  // ...existing fields...
  variants?: VariantGroup[]
}

export interface MenuItemUpdate {
  // ...existing fields...
  variants?: VariantGroup[]
}
```

Note: `MenuItem.variants` is non-optional because the DB column has `DEFAULT '[]' NOT NULL`. The Supabase JS client will always return `[]` if no variants exist.

### No New Server Actions Needed

`updateMenuItem` and `createMenuItem` already accept arbitrary data from `MenuItemUpdate`/`MenuItemCreate`. Adding `variants?: VariantGroup[]` to those types is sufficient — the Server Actions pass the data object directly to Supabase and the JSONB column accepts it transparently.

```typescript
// This is all that's needed in updateMenuItem — no changes to the function body:
const { data: row, error } = await supabase
  .from('menu_items')
  .update(data)  // data may now include variants
  .eq('id', itemId)
  .eq('restaurant_id', restaurantId)
  .select()
  .single()
```

### VariantEditor — Controlled Component Pattern

`VariantEditor` is a **controlled component**: it holds no local state. All mutations produce a new `VariantGroup[]` array and call `onChange`. Parent (`MenuItemForm`) owns the state.

```typescript
interface VariantEditorProps {
  variants: VariantGroup[]
  onChange: (variants: VariantGroup[]) => void
}
```

This makes testing trivial (no async, no effects) and gives `MenuItemForm` a single source of truth for auto-save.

### Generating IDs for New Groups and Options

Use `crypto.randomUUID()` — available in all modern browsers and Next.js edge runtime. These IDs are client-side only, used as React keys, and stored in the JSONB blob. They are not DB primary keys.

```typescript
const addGroup = () => {
  onChange([...variants, { id: crypto.randomUUID(), name: '', options: [] }])
}

const addOption = (groupId: string) => {
  onChange(variants.map((g) =>
    g.id === groupId
      ? { ...g, options: [...g.options, { id: crypto.randomUUID(), name: '', price_cents: 0 }] }
      : g
  ))
}
```

### Auto-Save Integration in MenuItemForm

Add `variants` to state and include in `doSave`:

```typescript
const [variants, setVariants] = useState<VariantGroup[]>(item?.variants ?? [])

// Inside doSave — add variants to textData:
const textData = {
  name: name.trim(),
  description: description.trim() || null,
  price_cents: priceCents,
  category_id: categoryId,
  variants,  // ← add this
}

// Add variants to useEffect deps:
useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current)
  if (!name.trim()) return
  timerRef.current = setTimeout(() => { void doSave() }, 2000)
  return () => { if (timerRef.current) clearTimeout(timerRef.current) }
}, [name, description, priceCents, categoryId, pendingImageFile, imageRemoved, variants])  // ← add variants
```

### VariantEditor UX Rules

- **No toasts** — VariantEditor produces no feedback; save status comes from `MenuItemForm`'s existing "Saving…" / "Saved ✓" indicator
- **No confirmation dialogs for remove** — removing a variant group or option is a form-level action (not a data deletion the user can't reverse); this is consistent with UX spec ("Confirmation dialogs only for destructive actions")
- **Validation**: group name and option name inputs validate on blur — show inline red text below the field if empty, but do NOT block the auto-save (empty names are the user's problem; the data just saves as-is)
- **Max 6 options** per group — `disabled` the "Add option" button when `group.options.length >= 6`; no error message needed
- **Price input**: same pattern as `MenuItemForm` price field — `type="number" inputMode="decimal" min="0" step="0.01"` with "$" prefix span; convert to/from `price_cents` via `Math.round(parseFloat(value) * 100)` and `(price_cents / 100).toFixed(2)`
- **Desktop-primary layout** — menu builder is a setup task; single-column form layout is fine; no mobile special-casing beyond `min-h-[44px]` tap targets

### Supabase Import Path

Architecture doc says `utils/supabase/` — **ignore this**. Actual codebase uses `lib/supabase/`:
- Server Actions → `import { createClient } from '@/lib/supabase/server'`
- Client Components → `import { createClient } from '@/lib/supabase/client'`
- No Supabase client needed in `VariantEditor` — it's a pure controlled component

### Testing Pattern

**VariantEditor tests** — `tests/unit/menu/VariantEditor.test.tsx` (jsdom):
```typescript
// @vitest-environment jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
import { VariantEditor } from '@/components/admin/VariantEditor'
```

Test cases:
- Renders existing groups and options with correct names and prices
- "Add variant group" calls onChange with a new group appended
- "Add option" calls onChange with a new option appended to the correct group
- Remove group button calls onChange with that group removed
- Remove option button calls onChange with that option removed from its group
- "Add option" is disabled when group has 6 options
- Price input converts from cents to display value correctly

**MenuItemForm test additions** — in existing `tests/unit/menu/MenuItemForm.test.tsx`:
- VariantEditor is rendered (check for "Add variant group" button)
- Changing a variant triggers auto-save debounce (change a variant → advance timers → verify `updateMenuItem` called with variants)

`VariantEditor` must be mocked in `MenuItemForm` tests to avoid rendering complexity:
```typescript
vi.mock('@/components/admin/VariantEditor', () => ({
  VariantEditor: ({ onChange }: { onChange: (v: unknown[]) => void }) => (
    <button onClick={() => onChange([{ id: 'v1', name: 'Size', options: [] }])}>
      mock-variant-change
    </button>
  ),
}))
```

### What This Story Does NOT Change

- `actions/menuActions.ts` function bodies — no changes needed; existing `updateMenuItem` / `createMenuItem` handle JSONB transparently
- `app/admin/menu/page.tsx` — no change
- `CategoryManager.tsx` — no change
- Availability scheduling (`AvailabilitySchedule`) — Story 2.4 scope
- Item reordering — Story 2.5 scope
- Customer-facing variant display — variants are stored here; customer rendering is Story 4.3 (`ItemConfigSheet`)
- `is_published` — Story 2.7 scope; don't touch it here

### MenuItem type — variants cast

When reading from Supabase, `row.variants` arrives typed as `Json` (the generated Supabase type). Cast at the boundary:

```typescript
// In updateMenuItem / createMenuItem return:
return { success: true, data: { item: { ...row, variants: (row.variants ?? []) as VariantGroup[] } as MenuItem } }
```

Do the same cast anywhere `menu_items` rows are read directly (e.g., `app/admin/menu/[item_id]/page.tsx` — no change needed there if you just pass the data through; the cast lives in the Server Action return).

### References

- Previous migration pattern: `supabase/migrations/20260510120000_add_menu_item_image_url.sql`
- `getAuthContext()` helper: `actions/menuActions.ts:7` (do not re-implement)
- `MenuItemForm.tsx` auto-save pattern: `components/admin/MenuItemForm.tsx:101` (useEffect + timerRef)
- `ActionResult<T>` type: `types/app.ts`
- UX spec form patterns: `_bmad-output/planning-artifacts/ux-design-specification.md` § "Form Patterns"
- UX spec modal rules: `_bmad-output/planning-artifacts/ux-design-specification.md` § "Modal and Overlay Patterns"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 4 tasks complete; 72 unit tests passing (6 test files)
- DB column applied via Supabase MCP (migration version 20260511112111)
- VariantEditor is a pure controlled component — no local state, easy to test
- MenuItemForm `textData` now includes `variants`; useEffect dep array updated accordingly
- VariantEditor renders below Category field in the form

### File List

- `supabase/migrations/20260511100000_add_menu_item_variants.sql` (new)
- `types/app.ts` (modified — VariantOption, VariantGroup, variants field on MenuItem/MenuItemCreate/MenuItemUpdate)
- `components/admin/VariantEditor.tsx` (new)
- `components/admin/MenuItemForm.tsx` (modified — variants state, doSave integration, useEffect deps, VariantEditor render)
- `tests/unit/menu/VariantEditor.test.tsx` (new)
- `tests/unit/menu/MenuItemForm.test.tsx` (modified — VariantEditor mock + new test cases)

### Change Log

- 2026-05-11: Story 2.3 complete — DB migration applied, VariantGroup/VariantOption types added, VariantEditor component built with 9 unit tests, integrated into MenuItemForm (variants in save payload + useEffect deps + JSX render). 72/72 tests passing.
