# Story 3.2: Table Deletion & QR Code Invalidation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to delete a table and its QR code,
So that decommissioned tables can no longer be used to place orders.

## Acceptance Criteria

**AC1** — Deletion requires confirmation:
Given an authenticated owner is on `/admin/tables`
When they click the "Delete" button on a `TableCard`
Then a confirmation dialog appears asking them to confirm the deletion

**AC2** — Confirmed deletion removes the table:
Given the confirmation dialog is open
When the owner confirms deletion
Then the `tables` row is deleted from the database via `tableActions.deleteTable()`
And the table disappears from the list (via `router.refresh()`)

**AC3** — QR code is effectively invalidated:
Given a table is deleted
When a customer scans the now-invalidated QR code URL
Then they see the "Menu unavailable" error state — the route resolves but returns no valid table (Epic 4 customer route handles this; this story only ensures the row is deleted)

**AC4** — Delete failure is shown inline, table remains:
Given the Server Action for delete fails
When the error is returned
Then an inline error message is shown inside the confirmation dialog
And the table remains in the list (dialog stays open)

**AC5** — Cancel aborts deletion:
Given the confirmation dialog is open
When the owner clicks "Cancel"
Then the dialog closes and no deletion occurs

## Tasks / Subtasks

- [x] Task 1: Add `deleteTable()` to `actions/tableActions.ts` (AC: 2, 4)
  - [x] Export `deleteTable(tableId: string): Promise<ActionResult<void>>`
  - [x] Call `getAuthContext()` (already defined in the file — do NOT re-define)
  - [x] Check auth and restaurant (same pattern as `createTable`)
  - [x] Execute: `.from('tables').delete().eq('id', tableId).eq('restaurant_id', restaurantId)`
  - [x] The `.eq('restaurant_id', restaurantId)` guard ensures owners can only delete their own tables (defense in depth on top of RLS)
  - [x] DB error: return `{ success: false, error: error.message }`
  - [x] Success: return `{ success: true, data: undefined }`

- [x] Task 2: Update `components/admin/TableCard.tsx` to add delete UI (AC: 1, 2, 4, 5)
  - [x] Convert to a richer client component — add `useRouter` from `next/navigation`
  - [x] Add state: `showConfirm` (boolean), `isDeleting` (boolean), `deleteError` (string | null)
  - [x] Add import: `deleteTable` from `@/actions/tableActions`
  - [x] "Delete table" button: shown in the card header area, triggers `setShowConfirm(true)`
  - [x] Confirmation overlay: `{showConfirm && <dialog>}` — use the same fixed overlay pattern as `MenuItemList.tsx`:
    - `className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"`
    - Inner panel: `className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg"`
    - Title: `Delete Table {table.number}?`
    - Body: `"This QR code will stop working immediately."`
    - If `deleteError`: show inline `<p role="alert">{deleteError}</p>` in red
    - Cancel button: `onClick={() => { setShowConfirm(false); setDeleteError(null) }}`
    - Confirm button: `onClick={handleDelete}`, `disabled={isDeleting}`, text: `isDeleting ? 'Deleting…' : 'Delete table'` — red button matching `bg-red-500` style from existing pattern
  - [x] `handleDelete` async function:
    - Set `isDeleting(true)`, `deleteError(null)`
    - Call `await deleteTable(table.id)`
    - On success: call `router.refresh()` — the Server Component page re-fetches and the card disappears
    - On failure: set `deleteError(result.error)`, set `isDeleting(false)` (dialog stays open)
    - Wrap in try/catch: catch → set `deleteError('Unable to delete — tap to try again')`, set `isDeleting(false)`

- [x] Task 3: Write tests (AC: 1, 2, 4)
  - [x] Extend `tests/unit/tables/tableActions.test.ts`:
    - [x] Add `deleteTable` to import line
    - [x] Add `makeDeleteAuthClient()` helper: `.delete().eq().eq()` chain with Promise-resolved final `.eq()`
    - [x] New `describe('deleteTable')` block with cases:
      1. Not authenticated → `{ success: false, error: 'Not authenticated' }`
      2. No restaurant → `{ success: false, error: 'No restaurant found' }`
      3. Success → `{ success: true, data: undefined }`
      4. Generic DB error → `{ success: false, error: 'DB error message' }`

### Review Findings

- [x] [Review][Patch] Dialog not closed and `isDeleting` not reset on success path — added `setShowConfirm(false)` before `router.refresh()`, moved `setIsDeleting(false)` to `finally` block [components/admin/TableCard.tsx]
- [x] [Review][Patch] Missing `aria-modal="true"` on dialog element — added to match `MenuItemList.tsx` reference pattern [components/admin/TableCard.tsx]
- [x] [Review][Patch] Cancel button missing `border border-border` styling — added to match `MenuItemList.tsx` pattern [components/admin/TableCard.tsx]
- [x] [Review][Patch] `deleteError` not cleared when Delete button re-opens dialog — Delete button onClick now calls `setDeleteError(null)` alongside `setShowConfirm(true)` [components/admin/TableCard.tsx]
- [x] [Review][Patch] Duplicate hardcoded `id="delete-table-dialog-title"` when multiple TableCard instances render — replaced with `dialogTitleId = \`delete-table-${table.id}-title\`` [components/admin/TableCard.tsx]
- [x] [Review][Defer] No focus trap on dialog — keyboard users can Tab behind the overlay; pre-existing pattern across all dialogs in this codebase (see 2-7 deferred item) [components/admin/TableCard.tsx]
- [x] [Review][Defer] Fixed overlay stacking-context: `fixed inset-0` rendered inside card div, not a portal — parent with CSS `transform`/`filter` would break fixed positioning; same pattern as MenuItemList.tsx; pre-existing [components/admin/TableCard.tsx]
- [x] [Review][Defer] Backdrop click does not dismiss dialog — same pattern as MenuItemList.tsx and CategoryManager.tsx; pre-existing across all project dialogs [components/admin/TableCard.tsx]
- [x] [Review][Defer] Silent no-op success when tableId doesn't match any row — Supabase DELETE with no matching rows returns `{ error: null }`; `router.refresh()` is called as if success; same pattern as `deleteMenuItem`/`deleteCategory` which also don't check row count [actions/tableActions.ts]

## Dev Notes

### What Already Exists — Do NOT Reinvent

- **`actions/tableActions.ts`** — already has `'use server'` directive, `getAuthContext()` (private), and `createTable()`. Add `deleteTable()` at the bottom. Do NOT re-define `getAuthContext()`.

- **`components/admin/TableCard.tsx`** — already exists as a `'use client'` component. It already imports `Table` from `@/types/app`, `generateQrUrl` from `@/utils/generateQrUrl`, and `QrCodeDisplay`. Story 3.1 explicitly noted: "No delete button — that is Story 3.2 scope." Extend it — do NOT rewrite from scratch.

- **Delete confirmation dialog pattern** — already established in `components/admin/MenuItemList.tsx` (lines 152–290) and `components/admin/CategoryManager.tsx`. Both use:
  - `deleteTarget` / `showConfirm` boolean state
  - `isDeleting` boolean state
  - `deleteError` string state
  - Fixed overlay with `bg-black/40` backdrop
  - Inner panel: `rounded-xl bg-surface-raised p-6 shadow-lg`
  - Cancel + red confirm button pattern
  - **Follow this pattern exactly** — do not invent a different UI.

- **RLS policy** — `owner_all_tables` (defined in `20260509144631_rls_policies.sql`) already covers `FOR ALL` including DELETE. No new migration needed for this story.

- **ON DELETE CASCADE** — the `tables` schema already defines `orders.table_id` with no cascade clause explicitly listed in the migration we've seen, but the delete invalidates QR codes by removing the row. Epic 4's customer route will return a "Menu unavailable" state when `table_id` resolves to null. This story only needs to delete the row.

- **`router.refresh()`** — correct approach post-deletion. The `TablesPage` (`app/admin/tables/page.tsx`) is a Server Component that re-fetches tables on each render. After `router.refresh()`, it re-renders without the deleted table.

### `actions/tableActions.ts` — New `deleteTable` Addition

Add to the bottom of the existing file, after `createTable`:

```typescript
export async function deleteTable(tableId: string): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
```

The double `.eq()` guard (both `id` and `restaurant_id`) means even if a bug passes the wrong `tableId`, the restaurant-scoped guard prevents cross-tenant deletion — defense in depth on top of RLS.

### `components/admin/TableCard.tsx` — Updated Full Structure

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Table } from '@/types/app'
import { generateQrUrl } from '@/utils/generateQrUrl'
import { QrCodeDisplay } from './QrCodeDisplay'
import { deleteTable } from '@/actions/tableActions'

interface Props {
  table: Table
  restaurantSlug: string
}

export function TableCard({ table, restaurantSlug }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteTable(table.id)
      if (result.success) {
        router.refresh()
      } else {
        setDeleteError(result.error)
        setIsDeleting(false)
      }
    } catch {
      setDeleteError('Unable to delete — tap to try again')
      setIsDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">Table {table.number}</p>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="text-xs text-text-secondary hover:text-red-500"
        >
          Delete
        </button>
      </div>
      <QrCodeDisplay
        url={generateQrUrl(restaurantSlug, table.number)}
        tableNumber={table.number}
      />

      {showConfirm && (
        <div
          role="dialog"
          aria-labelledby="delete-table-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg">
            <h2
              id="delete-table-dialog-title"
              className="mb-2 text-base font-semibold text-text-primary"
            >
              Delete Table {table.number}?
            </h2>
            <p className="mb-4 text-sm text-text-secondary">
              This QR code will stop working immediately.
            </p>
            {deleteError && (
              <p role="alert" className="mb-3 text-sm text-red-500">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setDeleteError(null) }}
                disabled={isDeleting}
                className="rounded-xl px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Testing Pattern — `deleteTable` Extension

Extend the existing `tests/unit/tables/tableActions.test.ts` (do NOT create a new file). Add `deleteTable` to the import, add a helper, and add a `describe` block:

```typescript
// Add to imports at top:
import { createTable, deleteTable } from '@/actions/tableActions'

// Add this helper after makeInsertChain:
function makeDeleteChain(
  result: { error: { message: string } | null }
) {
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // second .eq() also returns this via the same chain
  }
}
```

For the mock client in deleteTable tests, the `from('tables')` branch returns a chain ending in the delete result (no `.single()` needed — Supabase batch delete returns `{ error }` directly):

```typescript
function makeDeleteAuthClient(
  restaurantId: string | null = RESTAURANT_ID,
  deleteError: { message: string } | null = null
) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileData = restaurantId ? { restaurant_id: restaurantId } : null
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
        }
      }
      // tables branch — delete chain
      const mockEq = vi.fn().mockReturnThis()
      return {
        delete: vi.fn().mockReturnValue({ eq: mockEq }),
        eq: mockEq, // matches second .eq() chained on delete result
        // Simulate resolved value at the end of the chain
        then: undefined, // not needed — vitest resolves via the last .eq()
      }
    }),
  }
}
```

**NOTE:** The Supabase delete chain `.delete().eq().eq()` resolves to `{ error }` — not `.single()`. The simplest way to mock this is to make the last `.eq()` call return a Promise:

```typescript
function makeDeleteAuthClient(
  restaurantId: string | null = RESTAURANT_ID,
  deleteError: { message: string } | null = null
) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        const profileData = restaurantId ? { restaurant_id: restaurantId } : null
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
        }
      }
      // Supabase delete().eq().eq() → resolved Promise
      const finalEq = vi.fn().mockResolvedValue({ error: deleteError })
      const firstEq = vi.fn().mockReturnValue({ eq: finalEq })
      return { delete: vi.fn().mockReturnValue({ eq: firstEq }) }
    }),
  }
}

describe('deleteTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any)
    const result = await deleteTable('table-id-123')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Not authenticated')
  })

  it('returns error when no restaurant found', async () => {
    vi.mocked(createClient).mockResolvedValue(makeDeleteAuthClient(null) as any)
    const result = await deleteTable('table-id-123')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No restaurant found')
  })

  it('returns success on valid delete', async () => {
    vi.mocked(createClient).mockResolvedValue(makeDeleteAuthClient() as any)
    const result = await deleteTable('table-id-123')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBeUndefined()
  })

  it('returns DB error message on failure', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeDeleteAuthClient(RESTAURANT_ID, { message: 'connection refused' }) as any
    )
    const result = await deleteTable('table-id-123')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('connection refused')
  })
})
```

### QR Code Invalidation — No Extra Work Required

When `tables.id` is deleted:
- The DB row is gone; RLS and Epic 4's route handler will naturally resolve the QR URL to "no table found"
- Epic 4 (`app/[restaurant_slug]/[table_number]/page.tsx`) is responsible for the "Menu unavailable" UI — it is out of scope for this story
- No migration needed — the existing `tables` table and its `UNIQUE(restaurant_id, number)` constraint are unchanged

### No Migration Needed

The `tables` table and all RLS policies were created in story 1.2 migrations. This story is purely application-layer: a new server action + UI update to `TableCard`. No `supabase/migrations/` file is needed.

### What This Story Does NOT Change

- `app/admin/tables/page.tsx` — no changes; `router.refresh()` in `TableCard` causes the Server Component to re-fetch
- `actions/restaurantActions.ts` — unchanged
- `utils/generateQrUrl.ts` — unchanged
- `components/admin/QrCodeDisplay.tsx` — unchanged
- `components/admin/CreateTableForm.tsx` — unchanged
- `types/app.ts` — unchanged
- Any customer-facing route — Epic 4 scope

### References

- [Source: components/admin/MenuItemList.tsx lines 152–290] — delete confirmation dialog pattern to follow exactly (fixed overlay, `bg-black/40`, `bg-surface-raised`, Cancel + red Confirm buttons, `isDeleting` state, inline error)
- [Source: actions/tableActions.ts] — `getAuthContext()` private function and `ActionResult` pattern; add `deleteTable` after `createTable`
- [Source: tests/unit/tables/tableActions.test.ts] — existing test structure, `makeInsertChain` helper pattern; extend with `deleteTable` describe block
- [Source: supabase/migrations/20260509144631_rls_policies.sql] — `owner_all_tables` FOR ALL policy covers DELETE; no new migration needed
- [Source: supabase/migrations/20260509144558_initial_schema.sql] — `tables` schema with `UNIQUE(restaurant_id, number)` and `ON DELETE CASCADE` on `restaurant_id`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `deleteTable(tableId: string): Promise<ActionResult<void>>` to `actions/tableActions.ts` — reuses existing `getAuthContext()`, double-guards with `.eq('id').eq('restaurant_id')` for defense in depth
- Updated `components/admin/TableCard.tsx` — added Delete button in card header, fixed overlay confirmation dialog matching the `MenuItemList.tsx` pattern exactly (`bg-black/40` backdrop, `bg-surface-raised` panel, red confirm button, inline error via `role="alert"`, `router.refresh()` on success)
- Extended `tests/unit/tables/tableActions.test.ts` — added `makeDeleteAuthClient` helper and `describe('deleteTable')` block with 4 test cases (not-auth, no-restaurant, success, DB error); all 187 tests pass (21 test files, no regressions)

### File List

- `actions/tableActions.ts` (modified — added `deleteTable()`)
- `components/admin/TableCard.tsx` (modified — added delete button, confirmation dialog, `useRouter`, `showConfirm`/`isDeleting`/`deleteError` state)
- `tests/unit/tables/tableActions.test.ts` (modified — added `deleteTable` import, `makeDeleteAuthClient` helper, `describe('deleteTable')` block with 4 tests)

### Change Log

- 2026-05-17: Implemented story 3-2 — table deletion with inline confirmation dialog, `deleteTable()` server action, 4 new tests; 187 tests pass total
