# Story 2.7: Menu Publish, Offline Control & Onboarding Checklist

Status: done

## Story

As a restaurant owner,
I want to publish my menu so customers can order from it and take it offline when needed,
So that I control when my menu is live and am guided through the final setup steps after publishing.

## Acceptance Criteria

**AC1** — Publish action sets menu live:
Given an owner triggers "Publish"
When `publishMenu()` completes
Then `restaurants.is_published` is set to `true` and the menu is live to QR-scanning customers

**AC2** — Publish success state shows next steps:
Given the menu is successfully published
When the success state renders
Then the message "Your menu is live. Print your QR codes and place them on tables." is shown
And a direct link to the Tables section (`/admin/tables`) is present

**AC3** — Take offline requires confirmation:
Given the owner triggers "Take offline"
When a confirmation dialog is shown and the owner confirms
Then `restaurants.is_published` is set to `false`
And customers scanning the QR code would see the "Menu unavailable" state

**AC4** — Onboarding checklist reflects real state:
Given the owner is on the admin dashboard
When the OnboardingChecklist renders
Then "Add menu items" is marked complete when at least one menu item exists
And "Preview menu" is marked complete after the owner has visited `/admin/menu/preview`
And "Publish menu" is marked complete when `restaurants.is_published` is `true`

## Tasks / Subtasks

- [x] Task 1: DB migration — add `has_previewed_menu` column (AC: 4)
  - [x] Create `supabase/migrations/20260518100000_add_restaurant_has_previewed_menu.sql`
  - [x] `ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS has_previewed_menu boolean DEFAULT false NOT NULL;`
  - [x] Apply migration via Supabase MCP (`mcp__supabase__apply_migration`)

- [x] Task 2: Add `Restaurant` type to `types/app.ts` (AC: 1, 3, 4)
  - [x] Add `Restaurant` interface: `{ id: string; slug: string; name: string; is_published: boolean; has_previewed_menu: boolean; created_at: string }`

- [x] Task 3: Create `actions/restaurantActions.ts` (AC: 1, 3, 4)
  - [x] Define local `getAuthContext()` — same pattern as `menuActions.ts`: get user, lookup `restaurant_id` from profiles, return both
  - [x] Export `publishMenu(): Promise<ActionResult<void>>` — updates `restaurants.is_published = true` for owner's restaurant
  - [x] Export `takeMenuOffline(): Promise<ActionResult<void>>` — updates `restaurants.is_published = false` for owner's restaurant
  - [x] Export `recordMenuPreview(): Promise<ActionResult<void>>` — updates `restaurants.has_previewed_menu = true` for owner's restaurant (idempotent)
  - [x] All three actions must return `{ success: false, error: 'Not authenticated' }` when not authenticated
  - [x] All three actions must return `{ success: false, error: 'No restaurant found' }` when `restaurantId` is null

- [x] Task 4: Create `components/admin/MenuPublishToggle.tsx` (AC: 1, 2, 3)
  - [x] `'use client'` component with `interface Props { isPublished: boolean }`
  - [x] When `isPublished === false`: render "Publish menu" primary button; on click call `publishMenu()`, show loading state ("Publishing…"), on success call `router.refresh()`; on error show inline error message
  - [x] When `isPublished === true`: render the "live" success banner — "Your menu is live. Print your QR codes and place them on tables." with `<Link href="/admin/tables">Go to Tables →</Link>`; also render "Take offline" destructive button
  - [x] "Take offline" opens a confirmation dialog (same pattern as delete dialogs in `MenuItemList.tsx`) — show "Take menu offline?" warning text; on confirm call `takeMenuOffline()`, show loading ("Taking offline…"); on success call `router.refresh()`; on error show inline error; Cancel closes dialog
  - [x] Import `publishMenu`, `takeMenuOffline` from `@/actions/restaurantActions`
  - [x] Import `useRouter` from `next/navigation` — call `router.refresh()` after successful action

- [x] Task 5: Update `app/admin/menu/page.tsx` (AC: 1, 2, 3)
  - [x] Add `supabase.from('restaurants').select('is_published').single()` to the existing `Promise.all`
  - [x] Render `<MenuPublishToggle isPublished={restaurant?.is_published ?? false} />` at the top of the page content (below `<h1>Menu</h1>`, above categories section)
  - [x] Import `MenuPublishToggle` from `@/components/admin/MenuPublishToggle`

- [x] Task 6: Update `app/admin/menu/preview/page.tsx` (AC: 4)
  - [x] Import `recordMenuPreview` from `@/actions/restaurantActions`
  - [x] Call `await recordMenuPreview()` at the top of the Server Component function body, before the data-fetching Promise.all
  - [x] Ignore the return value — if it fails (e.g. race condition), the preview still renders normally

- [x] Task 7: Update `app/admin/page.tsx` (AC: 4)
  - [x] Make the function `async`
  - [x] Import `createClient` from `@/lib/supabase/server`
  - [x] Fetch: `supabase.from('restaurants').select('is_published, has_previewed_menu').single()`
  - [x] Fetch: `supabase.from('menu_items').select('id').limit(1)` (to detect `hasMenuItems`)
  - [x] Run both queries in `Promise.all`
  - [x] Pass real values: `hasMenuItems={!!menuItemsCheck?.length}`, `hasPreviewedMenu={restaurant?.has_previewed_menu ?? false}`, `isPublished={restaurant?.is_published ?? false}`
  - [x] Leave `hasTables={false}` and `hasPrintedQr={false}` — those are Epic 3 scope

- [x] Task 8: Write tests (AC: 1, 2, 3, 4)
  - [x] Create `tests/unit/menu/restaurantActions.test.ts` — test `publishMenu`, `takeMenuOffline`, `recordMenuPreview`: not-authenticated returns error, no-restaurant returns error, success path calls correct update, DB error propagates
  - [x] Create `tests/unit/menu/MenuPublishToggle.test.tsx` — test: renders "Publish menu" button when `isPublished=false`; renders live banner and "Take offline" button when `isPublished=true`; clicking "Take offline" opens confirmation dialog; cancel closes dialog without calling action; confirm calls `takeMenuOffline`; error from action shows inline

### Review Findings

- [x] [Review][Patch] Cancel button on offline dialog doesn't clear error state — stale error from prior failed attempt shows when dialog is reopened [components/admin/MenuPublishToggle.tsx:Cancel onClick]
- [x] [Review][Defer] Dialog has no focus trap and does not restore focus to trigger on close — keyboard/screen-reader concern [components/admin/MenuPublishToggle.tsx:93-131] — deferred, beyond spec scope
- [x] [Review][Defer] `getAuthContext` discards profile query error — transient DB failure returns 'No restaurant found' instead of a specific error — deferred, pre-existing pattern from menuActions.ts
- [x] [Review][Defer] `publishMenu`/`takeMenuOffline`/`recordMenuPreview` return success when 0 rows updated — Supabase UPDATE with RLS produces no error on 0-row result — deferred, pre-existing Supabase limitation
- [x] [Review][Defer] `isPublished` prop briefly stale between `setIsSubmitting(false)` and RSC re-render after `router.refresh()` — deferred, App Router pattern limitation
- [x] [Review][Defer] Supabase generated types not regenerated after `has_previewed_menu` migration — manual Restaurant interface diverges from generated schema — deferred, project-wide workflow task
- [x] [Review][Defer] OnboardingChecklist can never reach `allComplete=true` — `hasTables`/`hasPrintedQr` structurally hardcoded — deferred, by design (Epic 3 scope)
- [x] [Review][Defer] Double `getAuthContext` auth round trips per action call — deferred, pre-existing pattern from menuActions.ts
- [x] [Review][Defer] "Take offline" button has no `aria-label` associating it with the menu — deferred, low-impact accessibility

## Dev Notes

### What Already Exists — Do NOT Reinvent

- **`components/admin/OnboardingChecklist.tsx`** — fully built, accepts 5 boolean props. Do NOT modify its interface or rendering logic. This story only changes what values are passed to it.
- **`app/admin/page.tsx`** — exists, hardcodes all flags to `false`. This story makes it async and passes real data.
- **`restaurants.is_published`** — already exists in DB schema (initial migration). No migration needed for this column.
- **RLS** — `owner_update_own_restaurant` policy already allows `UPDATE` on the restaurant row for the authenticated owner using `get_my_restaurant_id()`. Use `createClient()` (not admin client) for all restaurant updates.
- **`app/admin/layout.tsx`** — already guards auth and restaurant existence. No changes needed.

### New Migration — `has_previewed_menu`

```sql
-- supabase/migrations/20260518100000_add_restaurant_has_previewed_menu.sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS has_previewed_menu boolean DEFAULT false NOT NULL;
```

Apply via MCP: `mcp__supabase__apply_migration` with name `add_restaurant_has_previewed_menu`.

### `actions/restaurantActions.ts` — Exact Pattern

Follow `menuActions.ts` exactly. Define `getAuthContext()` locally (do not import it from menuActions — it's not exported):

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/app'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, restaurantId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  return { supabase, user, restaurantId: profile?.restaurant_id ?? null }
}

export async function publishMenu(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ is_published: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function takeMenuOffline(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ is_published: false })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function recordMenuPreview(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ has_previewed_menu: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
```

### `components/admin/MenuPublishToggle.tsx` — Architecture

`'use client'` because: button clicks, dialog state, router.refresh() after action.

**Props:**
```typescript
interface Props {
  isPublished: boolean
}
```

**State:**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)
const [showOfflineConfirm, setShowOfflineConfirm] = useState(false)
const router = useRouter()
```

**Publish handler:**
```typescript
const handlePublish = async () => {
  setIsSubmitting(true)
  setError(null)
  try {
    const result = await publishMenu()
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error)
    }
  } catch {
    setError('Failed to publish — please try again')
  } finally {
    setIsSubmitting(false)
  }
}
```

**Take offline handler:** Same pattern, calls `takeMenuOffline()`, closes dialog on success.

**Render logic:**
```tsx
// Not published: show publish CTA
if (!isPublished) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      {error && <p role="alert" className="mb-3 text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={handlePublish}
        disabled={isSubmitting}
        className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Publishing…' : 'Publish menu'}
      </button>
    </div>
  )
}

// Published: show live banner + take offline
return (
  <>
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="mb-2 text-sm font-medium text-text-primary">
        Your menu is live. Print your QR codes and place them on tables.
      </p>
      <Link href="/admin/tables" className="text-sm text-accent hover:underline">
        Go to Tables →
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowOfflineConfirm(true)}
          className="text-sm text-red-500 hover:underline"
        >
          Take offline
        </button>
      </div>
    </div>

    {/* Confirmation dialog — same pattern as MenuItemList.tsx delete dialog */}
    {showOfflineConfirm && (
      <div role="dialog" aria-modal="true" aria-labelledby="offline-dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
          <h2 id="offline-dialog-title" className="mb-2 text-base font-semibold text-text-primary">
            Take menu offline?
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            Customers scanning your QR codes will see "Menu unavailable" until you publish again.
          </p>
          {error && <p role="alert" className="mb-4 text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowOfflineConfirm(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface">
              Cancel
            </button>
            <button type="button" onClick={handleTakeOffline} disabled={isSubmitting}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
              {isSubmitting ? 'Taking offline…' : 'Take offline'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
)
```

### `app/admin/menu/page.tsx` — Updated Data Fetch

```typescript
const [{ data: restaurant }, { data: categories }, { data: items }] = await Promise.all([
  supabase.from('restaurants').select('is_published').single(),
  supabase.from('categories').select('*').order('display_order', { ascending: true }),
  supabase.from('menu_items').select('*').order('display_order', { ascending: true }),
])
```

Render `<MenuPublishToggle isPublished={restaurant?.is_published ?? false} />` below the `<h1>Menu</h1>` heading, before the Categories and Items sections. Wrap it in a `<section className="mb-10">`.

### `app/admin/menu/preview/page.tsx` — Updated

```typescript
import { createClient } from '@/lib/supabase/server'
import { MenuPreview } from '@/components/admin/MenuPreview'
import { recordMenuPreview } from '@/actions/restaurantActions'

export default async function MenuPreviewPage() {
  await recordMenuPreview() // idempotent — sets has_previewed_menu = true on first visit

  const supabase = await createClient()
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    supabase.from('menu_items').select('*').order('display_order', { ascending: true }),
  ])

  return (
    <main className="min-h-screen">
      <MenuPreview categories={categories ?? []} items={items ?? []} />
    </main>
  )
}
```

`recordMenuPreview()` fires on every visit but is idempotent — the first call sets the flag, subsequent calls UPDATE to the same value.

### `app/admin/page.tsx` — Updated Dashboard

```typescript
import { createClient } from '@/lib/supabase/server'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ data: restaurant }, { data: menuItemsCheck }] = await Promise.all([
    supabase.from('restaurants').select('is_published, has_previewed_menu').single(),
    supabase.from('menu_items').select('id').limit(1),
  ])

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">Dashboard</h1>
        <OnboardingChecklist
          hasMenuItems={!!menuItemsCheck?.length}
          hasPreviewedMenu={restaurant?.has_previewed_menu ?? false}
          isPublished={restaurant?.is_published ?? false}
          hasTables={false}
          hasPrintedQr={false}
        />
      </div>
    </main>
  )
}
```

`hasTables` and `hasPrintedQr` remain `false` — Epic 3 will wire these up when tables are built.

### RLS — Why `createClient()` Works for Restaurant Updates

The `restaurants` table has this RLS policy (from `20260509144631_rls_policies.sql`):
```sql
CREATE POLICY "owner_update_own_restaurant" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (id = public.get_my_restaurant_id())
  WITH CHECK (id = public.get_my_restaurant_id());
```

`get_my_restaurant_id()` looks up `profiles.restaurant_id` for the current `auth.uid()`. So the standard `createClient()` (which uses the user's session) can UPDATE `is_published` and `has_previewed_menu` on the owner's restaurant row without needing the admin client.

### Testing Pattern for `restaurantActions.test.ts`

Follow `menuActions.item.test.ts` exactly:
- `// @vitest-environment node` at the top
- `vi.mock('server-only', () => ({}))` and `vi.mock('@/lib/supabase/server', ...)` at the top
- Use the `makeChain` helper pattern
- Test each action: not-authenticated, no-restaurant, success, DB error

The update query for `publishMenu` does NOT use `.single()` — it's a plain update chain: `.from('restaurants').update(...).eq('id', restaurantId)`. The chain resolves to `{ data, error }` directly (no `.single()` terminal). Mock accordingly:

```typescript
// In makeChain, add a thenable for direct resolution:
const chain = {
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  then: (resolve: (v: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve),
}
```

For error case, provide `{ data: null, error: { message: 'DB error' } }` in the `then` resolver.

### Testing Pattern for `MenuPublishToggle.test.tsx`

Mock server actions:
```typescript
vi.mock('@/actions/restaurantActions', () => ({
  publishMenu: vi.fn(),
  takeMenuOffline: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ refresh: vi.fn() })) }))
```

Use `@testing-library/react` render/screen/fireEvent/waitFor. Follow the delete dialog test patterns from `MenuItemList.test.tsx`.

### Accent Color Class

The UX spec defines "Publish" as a primary action using the accent color (`#FF6B35`). In Tailwind tokens it is `bg-accent` for the button background. Check that this token exists; if not, fall back to the existing pattern seen in other components (e.g., category manager uses `bg-accent`).

### What This Story Does NOT Change

- `components/admin/OnboardingChecklist.tsx` — do NOT touch the rendering logic or props interface
- `components/admin/MenuItemList.tsx` — no changes
- `components/admin/CategoryManager.tsx` — no changes
- `utils/isAvailable.ts`, `utils/formatPrice.ts` — no changes
- Any customer components — `components/customer/` is still empty (Epic 4)

### What Epic 3 Will Handle (Do NOT Build Now)

- `hasTables` real data — will query `tables` table in Epic 3's story 3.1
- `hasPrintedQr` real data — will require a `has_printed_qr` column, also Epic 3 scope

### References

- `actions/menuActions.ts` — `getAuthContext()` pattern and `ActionResult<T>` return shape to copy exactly
- `components/admin/MenuItemList.tsx` — confirmation dialog pattern (delete dialog) to mirror for "Take offline" dialog
- `components/admin/OnboardingChecklist.tsx` — existing component; understand its props before touching `app/admin/page.tsx`
- `app/admin/menu/page.tsx` — existing Server Component data fetch pattern to extend
- `app/admin/menu/preview/page.tsx` — existing Server Component to add `recordMenuPreview()` call to
- `supabase/migrations/20260509144631_rls_policies.sql` — confirms `owner_update_own_restaurant` policy exists
- `tests/unit/menu/menuActions.item.test.ts` — test structure and `makeChain` pattern to follow
- `tests/unit/menu/MenuItemList.test.tsx` — dialog interaction test patterns to follow

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `supabase/migrations/20260518100000_add_restaurant_has_previewed_menu.sql` and applied via Supabase MCP
- Added `Restaurant` interface to `types/app.ts`
- Created `actions/restaurantActions.ts` with `publishMenu`, `takeMenuOffline`, `recordMenuPreview` — all three follow the `getAuthContext` pattern from `menuActions.ts`, return `ActionResult<void>`, and use `createClient()` (RLS handles auth scoping)
- Created `components/admin/MenuPublishToggle.tsx` — client component with publish/take-offline flows; confirmation dialog mirrors `MenuItemList.tsx` delete dialog pattern
- Updated `app/admin/menu/page.tsx` — added restaurant fetch to `Promise.all`, renders `<MenuPublishToggle>` above categories
- Updated `app/admin/menu/preview/page.tsx` — calls `await recordMenuPreview()` before data fetch; return value ignored
- Updated `app/admin/page.tsx` — made async, fetches restaurant + menu_items count, passes real values to `<OnboardingChecklist>`; `hasTables` and `hasPrintedQr` remain `false` (Epic 3)
- 12 tests for `restaurantActions` (4 per action) + 8 tests for `MenuPublishToggle`; all 168 tests pass across 19 files

### File List

- `supabase/migrations/20260518100000_add_restaurant_has_previewed_menu.sql` (new)
- `types/app.ts` (modified — added `Restaurant` interface)
- `actions/restaurantActions.ts` (new)
- `components/admin/MenuPublishToggle.tsx` (new)
- `app/admin/menu/page.tsx` (modified)
- `app/admin/menu/preview/page.tsx` (modified)
- `app/admin/page.tsx` (modified)
- `tests/unit/menu/restaurantActions.test.ts` (new)
- `tests/unit/menu/MenuPublishToggle.test.tsx` (new)

### Change Log

- 2026-05-16: Implemented story 2-7 — menu publish/offline toggle, onboarding checklist with real data, has_previewed_menu migration
