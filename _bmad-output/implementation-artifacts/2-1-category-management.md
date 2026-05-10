# Story 2.1: Category Management

Status: done

## Story

As a restaurant owner,
I want to create and manage named categories for my menu,
So that my menu items are organized into sections customers can navigate easily.

## Acceptance Criteria

**AC1** — Create category:
Given an authenticated owner is on `/admin/menu`
When they create a new category with a name
Then the category is persisted to the `categories` table scoped to their `restaurant_id`
And it appears immediately in the category list

**AC2** — Rename category:
Given an owner has one or more categories
When they rename a category
Then the update is saved and reflected immediately in the builder

**AC3** — Delete category with items:
Given an owner deletes a category that still has items
When they confirm the destructive dialog
Then the category and all its menu items are deleted (not orphaned)

**AC4** — Empty state:
Given no categories exist
When the menu page renders
Then an empty state is shown with a CTA: "Add your first category →"

## Tasks / Subtasks

- [x] Task 1: Add `Category` type to `types/app.ts` (AC: 1, 2, 3)
  - [x] Add `Category` interface: `{ id: string; restaurant_id: string; name: string; display_order: number }`

- [x] Task 2: Create `actions/menuActions.ts` with category Server Actions (AC: 1, 2, 3)
  - [x] `createCategory(name: string): Promise<ActionResult<{ category: Category }>>` — INSERT into `categories`, `display_order` = count of existing categories
  - [x] `renameCategory(categoryId: string, name: string): Promise<ActionResult<{ category: Category }>>` — UPDATE name by id scoped to owner's restaurant
  - [x] `deleteCategory(categoryId: string): Promise<ActionResult<void>>` — DELETE `menu_items` WHERE `category_id` first, then DELETE category (FK is ON DELETE SET NULL — items must be explicitly deleted to satisfy AC3)
  - [x] All actions: authenticate user, resolve `restaurant_id` from profile, return `ActionResult<T>`

- [x] Task 3: Create `app/admin/menu/page.tsx` Server Component (AC: 1, 2, 3, 4)
  - [x] Server-side fetch: categories ordered by `display_order ASC`
  - [x] Pass categories to `<CategoryManager>` Client Component
  - [x] No auth guard needed — `app/admin/layout.tsx` already enforces auth + restaurant check

- [x] Task 4: Create `components/admin/CategoryManager.tsx` Client Component (AC: 1, 2, 3, 4)
  - [x] Inline "Add category" input at top — no modal
  - [x] Category list rows: name + rename (click to edit inline) + delete (trash icon)
  - [x] Delete triggers destructive confirmation dialog before calling `deleteCategory`
  - [x] Empty state: "Add your first category →" CTA that focuses the input
  - [x] Inline error below input on Server Action failure — no toasts

- [x] Task 5: Write unit tests for Server Actions (AC: 1, 2, 3)
  - [x] `createCategory` — persists with correct `restaurant_id`, returns category
  - [x] `renameCategory` — updates name, scoped to owner restaurant
  - [x] `deleteCategory` — deletes items first, then category; verifies both calls

### Review Findings (AI)

- [x] [Review][Patch] display_order uses COUNT instead of MAX — collides after any deletion [actions/menuActions.ts]
- [x] [Review][Patch] Rename failure silently swallowed — no inline error shown to user [components/admin/CategoryManager.tsx]
- [x] [Review][Patch] Delete failure silently swallowed — no inline error shown to user [components/admin/CategoryManager.tsx]
- [x] [Review][Patch] No in-flight guard on confirmDelete — double-submit possible [components/admin/CategoryManager.tsx]
- [x] [Review][Patch] Async event handlers lack try/catch — network errors cause unhandled rejections [components/admin/CategoryManager.tsx]
- [x] [Review][Patch] useRef unused import [components/admin/CategoryManager.tsx:3]
- [x] [Review][Patch] `as Category[]` unsafe cast bypasses TypeScript type-checking [app/admin/menu/page.tsx:19]
- [x] [Review][Patch] `role="form"` redundant on `<form aria-label=…>` element [components/admin/CategoryManager.tsx:75]
- [x] [Review][Defer] MenuPage relies solely on RLS for restaurant scoping — no defense-in-depth filter [app/admin/menu/page.tsx] — deferred, pre-existing architectural pattern per story Dev Notes
- [x] [Review][Defer] display_order concurrent race condition — true atomicity needs DB function [actions/menuActions.ts] — deferred, Story 2.5 owns reordering
- [x] [Review][Defer] No duplicate category name prevention — not an AC requirement for Story 2.1
- [x] [Review][Defer] MenuPage page-level auth guard absent — intentional, layout.tsx handles auth per story Dev Notes

## Dev Notes

### Critical: FK Conflict for Delete (AC3)

`menu_items.category_id` is defined as `REFERENCES public.categories(id) ON DELETE SET NULL`.
This means deleting a category via Supabase alone will NOT delete its items — they become orphaned with `category_id = NULL`.

The `deleteCategory` Server Action **must** delete items explicitly before deleting the category:
```typescript
// 1. Delete all items in the category first
await supabase.from('menu_items').delete().eq('category_id', categoryId).eq('restaurant_id', restaurantId)
// 2. Then delete the category
await supabase.from('categories').delete().eq('id', categoryId).eq('restaurant_id', restaurantId)
```
RLS (`owner_all_categories` and `owner_all_menu_items`) covers both operations — no admin client needed.

### Getting restaurant_id in Server Actions

Do NOT use `get_my_restaurant_id()` directly. Follow the pattern in `actions/authActions.ts`:
```typescript
const supabase = await createClient()   // lib/supabase/server — NOT utils/supabase
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { success: false, error: 'Not authenticated' }
const { data: profile } = await supabase
  .from('profiles').select('restaurant_id').eq('id', user.id).single()
if (!profile?.restaurant_id) return { success: false, error: 'No restaurant found' }
const restaurantId = profile.restaurant_id
```

### Supabase Import Path

Architecture doc says `utils/supabase/` — **ignore this**. Actual codebase uses `lib/supabase/`:
- Server Actions → `import { createClient } from '@/lib/supabase/server'`
- Client Components → `import { createClient } from '@/lib/supabase/client'`

### RLS on categories

`owner_all_categories` policy (migration `20260509144631_rls_policies.sql`):
```sql
CREATE POLICY "owner_all_categories" ON public.categories
  FOR ALL TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());
```
Owner can SELECT/INSERT/UPDATE/DELETE their own categories. No admin client needed.

### Categories Table Schema

From `supabase/migrations/20260509144558_initial_schema.sql`:
```sql
CREATE TABLE public.categories (
  id            uuid     DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid     NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text     NOT NULL,
  display_order integer  DEFAULT 0 NOT NULL
);
```
TypeScript type (auto-generated, `types/supabase.ts`):
```typescript
categories: {
  Row: { display_order: number; id: string; name: string; restaurant_id: string }
  Insert: { display_order?: number; id?: string; name: string; restaurant_id: string }
  Update: { display_order?: number; id?: string; name?: string; restaurant_id?: string }
}
```

### display_order for New Categories

`display_order` column exists but reordering is Story 2.5 scope. For Story 2.1, set `display_order` on create to a value that places new categories at the end:
```typescript
const { count } = await supabase
  .from('categories').select('*', { count: 'exact', head: true })
  .eq('restaurant_id', restaurantId)
// INSERT with display_order: (count ?? 0)
```

### Server Component → Client Component Split

`app/admin/menu/page.tsx` is a **Server Component** (SSR fetch, no `'use client'`):
```typescript
// SSR fetch — categories ordered for display
const { data: categories } = await supabase
  .from('categories').select('*').order('display_order', { ascending: true })
return <CategoryManager initialCategories={categories ?? []} />
```

`components/admin/CategoryManager.tsx` is a **Client Component** (`'use client'`) — it holds optimistic UI state and calls Server Actions.

### UX Rules (from UX spec)

- **No toasts** — UX spec explicitly bans them. Use inline error states only.
- **Destructive confirmation dialog** for delete — required for any delete action (UX spec: "reserved for genuinely destructive actions only"). Use design-md `Modal/dialog` component.
- **Dialog copy**: Cancel (secondary) + "Delete category" (destructive red `#FF3B30`).
- **Inline rename**: clicking category name makes it an editable input; blur/Enter saves; Escape cancels.
- **Error copy must be actionable**: "Unable to save — tap to try again", never "An error occurred."
- **Empty state copy**: "Add your first category →" — direct, actionable, not apologetic.
- Admin menu builder is desktop-primary (setup task, not live-service). Mobile still works — single column.

### What This Story Does NOT Change

- `app/admin/page.tsx` — `OnboardingChecklist` stays hardcoded `hasMenuItems={false}` for now. Categories ≠ menu items; the "Add menu items" checklist step is Story 2.2.
- No navigation component (tab bar / sidebar) — not in Story 2.1 scope; `/admin/menu` is reachable from the OnboardingChecklist link `href="/admin/menu"` already in `OnboardingChecklist.tsx`.
- No `app/admin/menu/new/` or `[item_id]/` routes — those are Story 2.2.

### Server Action Return Pattern (from types/app.ts)

```typescript
// Always use this — never throw from a Server Action
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```

### Testing: Server Actions in Vitest Node Environment

`menuActions.ts` uses `'use server'` and imports `server-only` transitively. Tests must:
```typescript
// @vitest-environment node
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
// then import after mocks
import { createCategory } from '@/actions/menuActions'
```
Pattern is identical to `tests/unit/auth/signOut.test.ts`. Do NOT reference outer `const` inside `vi.mock()` factory — vi.mock is hoisted. Use `vi.mocked(createClient).mockResolvedValue(...)` inside `beforeEach`.

### Project Structure Notes

New files for this story:
- `actions/menuActions.ts` — NEW (first file in menu domain)
- `app/admin/menu/page.tsx` — NEW (menu builder entry point)
- `components/admin/CategoryManager.tsx` — NEW

Modified files:
- `types/app.ts` — add `Category` type

Architecture reference paths (`architecture.md` → "Complete Project Directory Structure"):
- `actions/menuActions.ts`: `createMenuItem, updateMenuItem, deleteMenuItem, publishMenu, takeMenuOffline` listed — Story 2.1 adds category actions to this file as well
- `components/admin/CategoryManager.tsx`: listed as `[FR9, FR12] category CRUD + item reorder`
- `app/admin/menu/page.tsx`: listed as `[FR9, FR10–12]`

### References

- Categories schema: `supabase/migrations/20260509144558_initial_schema.sql`
- RLS policies: `supabase/migrations/20260509144631_rls_policies.sql`
- Server Action pattern: `actions/authActions.ts`
- `ActionResult<T>` type: `types/app.ts`
- OnboardingChecklist: `components/admin/OnboardingChecklist.tsx` (do not modify in this story)
- Admin layout (auth guard): `app/admin/layout.tsx`
- UX patterns (no toasts, destructive dialogs): `_bmad-output/planning-artifacts/ux-design-specification.md` sections "Modal and Overlay Patterns", "Empty States and Loading"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `Category` interface to `types/app.ts`
- Created `actions/menuActions.ts` with `createCategory`, `renameCategory`, `deleteCategory` — all follow `ActionResult<T>` pattern and resolve `restaurant_id` via profiles
- `deleteCategory` explicitly deletes `menu_items` WHERE `category_id` before deleting the category (FK is ON DELETE SET NULL — items would otherwise be orphaned)
- `display_order` set to current category count on create so new categories append to end
- Created `app/admin/menu/page.tsx` Server Component (SSR categories fetch, ordered by display_order ASC)
- Created `components/admin/CategoryManager.tsx` Client Component — inline create form, click-to-rename, destructive dialog on delete, empty state, inline errors (no toasts)
- 17 new tests: 8 Server Action tests (node env) + 9 component tests (jsdom) — 34 total suite-wide, all passing

### File List

- `types/app.ts` (modified)
- `actions/menuActions.ts` (new)
- `app/admin/menu/page.tsx` (new)
- `components/admin/CategoryManager.tsx` (new)
- `tests/unit/menu/menuActions.test.ts` (new)
- `tests/unit/menu/CategoryManager.test.tsx` (new)

### Change Log

- 2026-05-10: Story 2.1 implemented — Category Management (create, rename, delete with destructive dialog, empty state). 34 tests passing.
- 2026-05-10: Code review patches applied — 8 findings resolved: display_order COUNT→MAX+1, rename error state, delete error state, isDeleting guard, try/catch on async handlers, useRef removed, Category[] cast removed, redundant role="form" removed. 37 tests passing.
