# Story 3.1: Table Creation, QR Code Generation & Download

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to create tables and have unique QR codes generated automatically for each one, then download or print them,
So that customers at each table can scan their code and access my restaurant's menu.

## Acceptance Criteria

**AC1** — Table creation persists to database:
Given an authenticated owner is on `/admin/tables`
When they create a table with a number (e.g., "5")
Then a row is inserted in `tables` with `restaurant_id` and `number: integer`
And the table appears immediately in the list via the TableCard component

**AC2** — QR URL is correct and rendered immediately:
Given a table is created
When the system generates the QR code via `utils/generateQrUrl.ts`
Then the QR URL is `https://app.dine-in-cc.com/{restaurant_slug}/{table_number}`
And the QR code is rendered immediately via the QrCodeDisplay component

**AC3** — Download and print work:
Given a QR code is rendered
When the owner clicks "Download" or "Print"
Then the QR code is downloadable as a PNG image or printable directly from the browser

**AC4** — Onboarding checklist updates correctly:
Given the owner creates their first table and downloads or prints a QR code
When the dashboard renders
Then "Create tables" is marked complete when at least one table exists
And "Print QR codes" is marked complete after the first download or print action

**AC5** — Empty state shown when no tables exist:
Given no tables exist
When the tables page renders
Then an empty state with "Create your first table →" is shown

## Tasks / Subtasks

- [x] Task 1: DB migration — add `has_printed_qr` column to `restaurants` (AC: 4)
  - [x] Create `supabase/migrations/20260517120000_add_restaurant_has_printed_qr.sql`
  - [x] Content: `ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS has_printed_qr boolean DEFAULT false NOT NULL;`
  - [x] Apply migration via Supabase MCP: `mcp__supabase__apply_migration` with name `add_restaurant_has_printed_qr`

- [x] Task 2: Update types in `types/app.ts` (AC: 1, 4)
  - [x] Add `Table` interface: `{ id: string; restaurant_id: string; number: number; created_at: string }`
  - [x] Add `has_printed_qr: boolean` field to the existing `Restaurant` interface (already has `id`, `slug`, `name`, `is_published`, `has_previewed_menu`, `created_at`)

- [x] Task 3: Create `utils/generateQrUrl.ts` (AC: 2)
  - [x] Export `generateQrUrl(slug: string, tableNumber: number): string`
  - [x] Returns `https://app.dine-in-cc.com/${slug}/${tableNumber}`
  - [x] Pure function — no imports, no side effects

- [x] Task 4: Add `recordQrPrint()` to `actions/restaurantActions.ts` (AC: 4)
  - [x] Follow existing `getAuthContext()` + `ActionResult<void>` pattern exactly (already used by `publishMenu`, `takeMenuOffline`, `recordMenuPreview` in the same file)
  - [x] Export `recordQrPrint(): Promise<ActionResult<void>>` — updates `restaurants.has_printed_qr = true` (idempotent, no-op on repeat calls)
  - [x] Not-authenticated and no-restaurant checks required (same pattern as all other actions in this file)

- [x] Task 5: Create `actions/tableActions.ts` (AC: 1)
  - [x] `'use server'` directive at top
  - [x] Define local `async function getAuthContext()` — exact copy of the pattern from `restaurantActions.ts` (NOT imported — each action file defines its own)
  - [x] Export `createTable(number: number): Promise<ActionResult<{ id: string }>>`:
    - [x] Validate: `!Number.isInteger(number) || number < 1 || number > 999` → return `{ success: false, error: 'Table number must be an integer between 1 and 999' }`
    - [x] Check auth and restaurant (same as all other actions)
    - [x] `.from('tables').insert({ restaurant_id: restaurantId, number }).select('id').single()`
    - [x] If `error.code === '23505'` (Postgres unique_violation): return `{ success: false, error: \`Table ${number} already exists\` }`
    - [x] DB error: return `{ success: false, error: error.message }`
    - [x] Success: return `{ success: true, data: { id: data.id } }`

- [x] Task 6: Install `qrcode` package (AC: 2, 3)
  - [x] Run: `npm install qrcode && npm install -D @types/qrcode`
  - [x] Verify the package is browser-compatible (it is — `qrcode` supports both Node.js and browser)

- [x] Task 7: Create `components/admin/QrCodeDisplay.tsx` (AC: 2, 3, 4)
  - [x] `'use client'` component
  - [x] Props: `url: string`, `tableNumber: number`
  - [x] `useEffect` on `url`: call `QRCode.toDataURL(url, { width: 256, margin: 2 })`, set result into `qrDataUrl` state
  - [x] Display: while `qrDataUrl` is null, show `<div className="h-32 w-32 animate-pulse rounded bg-surface" />`; when populated, show `<img src={qrDataUrl} alt={\`QR code for table ${tableNumber}\`} width={128} height={128} />`
  - [x] "Download" button: creates programmatic `<a>` with `href={qrDataUrl}` and `download={\`table-${tableNumber}-qr.png\`}`, calls `.click()`, then calls `recordQrPrint()` (fire-and-forget, no `await` required)
  - [x] "Print" button: opens `window.open('', '_blank')`, writes `<img src="${qrDataUrl}" onload="window.print();window.close()" style="max-width:100%" />`, then calls `recordQrPrint()` (fire-and-forget)
  - [x] Both buttons `disabled={!qrDataUrl}`

- [x] Task 8: Create `components/admin/TableCard.tsx` (AC: 1, 2, 3)
  - [x] `'use client'` component (needed because it renders `QrCodeDisplay` which uses client hooks)
  - [x] Props: `table: Table`, `restaurantSlug: string`
  - [x] Renders: table number as heading (`Table {table.number}`), then `<QrCodeDisplay url={generateQrUrl(restaurantSlug, table.number)} tableNumber={table.number} />`
  - [x] Card style: `rounded-lg border border-border bg-surface-raised p-4` (matches existing card patterns)
  - [x] No delete button — that is Story 3.2 scope

- [x] Task 9: Create `components/admin/CreateTableForm.tsx` (AC: 1, 5)
  - [x] `'use client'` component
  - [x] State: `number` (string, controlled input), `isSubmitting` (boolean), `error` (string | null)
  - [x] On submit: `parseInt(number, 10)` → if `isNaN`, set error; otherwise call `createTable(num)`, on success clear input + `router.refresh()`, on failure set inline error
  - [x] Input: `type="number"`, `min={1}`, `max={999}`, `placeholder="e.g. 5"` — label "Table number"
  - [x] Submit button: `disabled={isSubmitting || !number}`, text: "Add table" / "Adding…"
  - [x] Error: `<p role="alert">` inline below the form

- [x] Task 10: Create `app/admin/tables/page.tsx` (AC: 1, 2, 3, 5)
  - [x] Server Component
  - [x] Fetch in `Promise.all`: `supabase.from('restaurants').select('id, slug').single()` and `supabase.from('tables').select('*').order('number', { ascending: true })`
  - [x] Structure: `<main>` → `<div className="mx-auto max-w-2xl">` → `<h1>Tables</h1>`, `<CreateTableForm />`, then list or empty state
  - [x] Empty state (when `!tables?.length`): `<p className="text-sm text-text-secondary">Create your first table →</p>`
  - [x] Table list: `tables.map(t => <TableCard key={t.id} table={t} restaurantSlug={restaurant?.slug ?? ''} />)` wrapped in `<div className="flex flex-col gap-4">`

- [x] Task 11: Update `app/admin/page.tsx` (AC: 4)
  - [x] Add `supabase.from('tables').select('id').limit(1)` to the existing `Promise.all` (currently has 2 queries — add as a third)
  - [x] Update restaurants query to also select `has_printed_qr`: `select('is_published, has_previewed_menu, has_printed_qr')`
  - [x] Update `OnboardingChecklist` props: `hasTables={!!tablesCheck?.length}` and `hasPrintedQr={restaurant?.has_printed_qr ?? false}` (replacing the current `false` hardcodes)

- [x] Task 12: Write tests (AC: 1, 2, 3, 4)
  - [x] Create `tests/unit/tables/tableActions.test.ts`:
    - [x] `// @vitest-environment node` at top
    - [x] `vi.mock('server-only', () => ({}))` and `vi.mock('@/lib/supabase/server', ...)`
    - [x] Test `createTable`: not-authenticated, no-restaurant, invalid number (0 and string-like), success path, duplicate number (error.code `'23505'`) returns friendly error, generic DB error propagates
  - [x] Create `tests/unit/tables/QrCodeDisplay.test.tsx`:
    - [x] Mock `qrcode`: `vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') } }))`
    - [x] Mock `@/actions/restaurantActions`: `vi.mock(...)` with `recordQrPrint: vi.fn().mockResolvedValue({ success: true, data: undefined })`
    - [x] Test: shows skeleton div before QR loads, shows `<img>` with correct alt text after effect runs (use `waitFor`), Download button calls `recordQrPrint`, Print button calls `recordQrPrint`, both buttons `disabled` before QR loads

### Review Findings

- [x] [Review][Patch] Malformed QR URL when restaurant fetch returns null — `restaurant?.slug ?? ''` passes empty string to `generateQrUrl`, producing `https://app.dine-in-cc.com//5`; TableCards should not render when restaurant is null [app/admin/tables/page.tsx]
- [x] [Review][Patch] `recordQrPrint()` called without `await` in handleDownload and handlePrint — silent failure means `has_printed_qr` is never set if auth expires or network fails, breaking AC4 [components/admin/QrCodeDisplay.tsx]
- [x] [Review][Patch] `QRCode.toDataURL()` has no `.catch()` — rejected promise leaves component stuck on loading skeleton forever with no error state [components/admin/QrCodeDisplay.tsx]
- [x] [Review][Patch] `CreateTableForm` input missing `step={1}` — browser allows decimal entry; `parseInt("1.9")` silently submits 1 with no user feedback [components/admin/CreateTableForm.tsx]
- [x] [Review][Defer] Admin page-level auth relies solely on layout + RLS, no explicit `getUser()` guard in `TablesPage` [app/admin/tables/page.tsx] — deferred, pre-existing pattern across all admin pages (see 2-1, 2-7 deferred items)
- [x] [Review][Defer] `getAuthContext()` `.single()` error is silently masked — profile query error is indistinguishable from missing profile [actions/tableActions.ts] — deferred, pre-existing pattern from menuActions.ts
- [x] [Review][Defer] `generateQrUrl` hardcodes `https://app.dine-in-cc.com` production domain — staging/dev QR codes point to production [utils/generateQrUrl.ts] — resolved post-review: switched to `NEXT_PUBLIC_APP_URL` env var with fallback to production domain

## Dev Notes

### What Already Exists — Do NOT Reinvent

- **`tables` DB schema** — fully defined in `supabase/migrations/20260509144558_initial_schema.sql`:
  ```sql
  CREATE TABLE public.tables (
    id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    number        integer     NOT NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    UNIQUE (restaurant_id, number)
  );
  ```
  No migration needed for the `tables` table itself — it exists and RLS is enabled.

- **RLS policy `owner_all_tables`** — defined in `supabase/migrations/20260509144631_rls_policies.sql`:
  ```sql
  CREATE POLICY "owner_all_tables" ON public.tables
    FOR ALL TO authenticated
    USING (restaurant_id = public.get_my_restaurant_id())
    WITH CHECK (restaurant_id = public.get_my_restaurant_id());
  ```
  Use `createClient()` (not admin client) — RLS handles auth scoping automatically.

- **`components/admin/AdminNav.tsx`** — already includes `/admin/tables` with `QrCode` icon from lucide-react. No navigation changes needed.

- **`components/admin/OnboardingChecklist.tsx`** — already accepts `hasTables` and `hasPrintedQr` props with the correct interface. Do NOT modify it. Only update `app/admin/page.tsx` to pass real values.

- **`actions/restaurantActions.ts`** — already contains `getAuthContext()`, `publishMenu`, `takeMenuOffline`, `recordMenuPreview`. Add `recordQrPrint()` following the exact same pattern. Do NOT restructure the file.

- **`Restaurant` interface in `types/app.ts`** — already exists. Only add `has_printed_qr: boolean` as a new field.

### New Migration — `has_printed_qr`

```sql
-- supabase/migrations/20260517120000_add_restaurant_has_printed_qr.sql
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS has_printed_qr boolean DEFAULT false NOT NULL;
```

Apply via MCP: `mcp__supabase__apply_migration` with name `add_restaurant_has_printed_qr`.

### QR Code Library

Install before implementing QrCodeDisplay:
```bash
npm install qrcode
npm install -D @types/qrcode
```

Use the `qrcode` npm package directly — it supports browser environments and generates PNG data URLs, which makes download trivial. Do NOT use `react-qr-code` or `qrcode.react` — those render SVG and require canvas conversion for PNG download.

```typescript
import QRCode from 'qrcode'

// In useEffect — generates a PNG data URL
const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 })
setQrDataUrl(dataUrl)
```

### `utils/generateQrUrl.ts` — Exact Implementation

```typescript
export function generateQrUrl(slug: string, tableNumber: number): string {
  return `https://app.dine-in-cc.com/${slug}/${tableNumber}`
}
```

Pure function, no imports. This URL is what Epic 4's customer QR scan will resolve to — the Next.js route will be `app/[restaurant_slug]/[table_number]/page.tsx` (Epic 4 scope, do not create now).

### `actions/tableActions.ts` — Full Pattern

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

export async function createTable(number: number): Promise<ActionResult<{ id: string }>> {
  if (!Number.isInteger(number) || number < 1 || number > 999) {
    return { success: false, error: 'Table number must be an integer between 1 and 999' }
  }

  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { data, error } = await supabase
    .from('tables')
    .insert({ restaurant_id: restaurantId, number })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: `Table ${number} already exists` }
    return { success: false, error: error.message }
  }
  return { success: true, data: { id: data.id } }
}
```

Key difference from `restaurantActions.ts`: `createTable` uses `.insert().select('id').single()` — it returns the inserted row's ID. Mock the chain accordingly in tests (see Testing Pattern below).

### `actions/restaurantActions.ts` — New `recordQrPrint` Addition

Add to the bottom of the existing file, after `recordMenuPreview`:

```typescript
export async function recordQrPrint(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ has_printed_qr: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
```

### `components/admin/QrCodeDisplay.tsx` — Full Architecture

```typescript
'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { recordQrPrint } from '@/actions/restaurantActions'

interface Props {
  url: string
  tableNumber: number
}

export function QrCodeDisplay({ url, tableNumber }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 256, margin: 2 }).then(setQrDataUrl)
  }, [url])

  const handleDownload = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `table-${tableNumber}-qr.png`
    a.click()
    recordQrPrint() // fire-and-forget — no await needed for UX continuity
  }

  const handlePrint = () => {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(
      `<img src="${qrDataUrl}" onload="window.print();window.close()" style="max-width:100%" />`
    )
    win.document.close()
    recordQrPrint() // fire-and-forget
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR code for table ${tableNumber}`}
          width={128}
          height={128}
          className="rounded"
        />
      ) : (
        <div className="h-32 w-32 animate-pulse rounded bg-surface" aria-label="Loading QR code" />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface disabled:opacity-50"
        >
          Download
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface disabled:opacity-50"
        >
          Print
        </button>
      </div>
    </div>
  )
}
```

### `app/admin/page.tsx` — Updated Promise.all

Current (story 2.7) has 2 queries. This story adds a 3rd and extends the restaurant select:

```typescript
const [{ data: restaurant }, { data: menuItemsCheck }, { data: tablesCheck }] = await Promise.all([
  supabase.from('restaurants').select('is_published, has_previewed_menu, has_printed_qr').single(),
  supabase.from('menu_items').select('id').limit(1),
  supabase.from('tables').select('id').limit(1),
])

// Updated OnboardingChecklist props:
<OnboardingChecklist
  hasMenuItems={!!menuItemsCheck?.length}
  hasPreviewedMenu={restaurant?.has_previewed_menu ?? false}
  isPublished={restaurant?.is_published ?? false}
  hasTables={!!tablesCheck?.length}          // was hardcoded false
  hasPrintedQr={restaurant?.has_printed_qr ?? false}  // was hardcoded false
/>
```

### Testing Pattern

**`tests/unit/tables/tableActions.test.ts`**

Follow `tests/unit/menu/restaurantActions.test.ts` exactly for setup:
- `// @vitest-environment node`
- `vi.mock('server-only', () => ({}))`
- `vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))`

The `createTable` insert chain uses `.insert().select('id').single()` — mock accordingly:

```typescript
// Success mock for createTable
const mockChain = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: 'test-uuid' }, error: null }),
}
```

Test cases for `createTable`:
1. Not authenticated → `{ success: false, error: 'Not authenticated' }`
2. No restaurant → `{ success: false, error: 'No restaurant found' }`
3. Invalid number (0) → `{ success: false, error: 'Table number must be an integer between 1 and 999' }`
4. Success → `{ success: true, data: { id: 'test-uuid' } }`
5. Duplicate (error.code `'23505'`) → `{ success: false, error: 'Table 5 already exists' }`
6. Generic DB error → `{ success: false, error: 'DB error message' }`

**`tests/unit/tables/QrCodeDisplay.test.tsx`**

```typescript
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock') }
}))
vi.mock('@/actions/restaurantActions', () => ({
  recordQrPrint: vi.fn().mockResolvedValue({ success: true, data: undefined }),
}))
```

Test cases:
1. Renders skeleton `div` initially (before async effect resolves)
2. Renders `<img>` with correct `alt` text after effect resolves (use `waitFor`)
3. Both buttons are disabled while `qrDataUrl` is null
4. Download button click calls `recordQrPrint`
5. Print button click calls `recordQrPrint`

### Project Structure Notes

- New action file `actions/tableActions.ts` follows existing convention (flat in `actions/` dir)
- New components `QrCodeDisplay.tsx`, `TableCard.tsx`, `CreateTableForm.tsx` go in `components/admin/` (flat, same as all other admin components)
- New route `app/admin/tables/page.tsx` — directory must be created, `app/admin/tables/` does not yet exist
- New tests go in `tests/unit/tables/` (new subdirectory, mirrors `tests/unit/menu/` structure)
- `utils/generateQrUrl.ts` goes in `utils/` (same level as `validateSlug.ts`, `formatPrice.ts`)

### What This Story Does NOT Change

- `components/admin/OnboardingChecklist.tsx` — props interface and rendering logic unchanged
- `components/admin/AdminNav.tsx` — Tables nav link already present
- `components/admin/MenuPublishToggle.tsx` — unchanged; the "Go to Tables →" link already points to `/admin/tables`
- Any customer-facing route — `app/[restaurant_slug]/[table_number]/` is Epic 4
- `supabase/migrations/*.sql` (existing) — only the new `has_printed_qr` migration is added
- Story 3.2 scope: table deletion, `tableActions.deleteTable()`, confirmation dialog in `TableCard`

### References

- [Source: actions/restaurantActions.ts] — `getAuthContext()` pattern and `ActionResult<void>` return shape to copy for `tableActions.ts` and `recordQrPrint()`
- [Source: types/app.ts] — existing `Restaurant` interface to extend; `ActionResult<T>` type definition
- [Source: components/admin/OnboardingChecklist.tsx] — props interface; confirm `hasTables` and `hasPrintedQr` are already defined
- [Source: app/admin/page.tsx] — existing two-query `Promise.all` pattern to extend with third query
- [Source: supabase/migrations/20260509144558_initial_schema.sql] — confirms `tables` schema exists; no migration needed for the table itself
- [Source: supabase/migrations/20260509144631_rls_policies.sql] — confirms `owner_all_tables` policy exists for full CRUD
- [Source: tests/unit/menu/restaurantActions.test.ts] — test structure, `vi.mock` patterns, `makeChain` helper to follow
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3] — BDD acceptance criteria and `generateQrUrl.ts` / `QrCodeDisplay` component names are architecturally required

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Applied `has_printed_qr boolean DEFAULT false` migration to `restaurants` table via Supabase MCP
- Added `Table` interface and `has_printed_qr` field to `Restaurant` in `types/app.ts`
- Created `utils/generateQrUrl.ts` — pure function returning `https://app.dine-in-cc.com/{slug}/{tableNumber}`
- Added `recordQrPrint()` to `actions/restaurantActions.ts` following identical pattern to `recordMenuPreview()`
- Created `actions/tableActions.ts` with `createTable()` — validates 1–999 integer, handles unique violation (code `23505`) with friendly message, returns inserted row ID
- Installed `qrcode` + `@types/qrcode` packages; used `QRCode.toDataURL()` for browser-compatible PNG data URL generation
- Created `components/admin/QrCodeDisplay.tsx` — useEffect generates QR data URL, download via programmatic `<a>` click, print via `window.open` with inline JS, both call `recordQrPrint()` fire-and-forget
- Created `components/admin/TableCard.tsx` — card with table number heading and QrCodeDisplay
- Created `components/admin/CreateTableForm.tsx` — controlled number input, calls `createTable()`, router.refresh() on success, inline error display
- Created `app/admin/tables/page.tsx` — Server Component fetching restaurant slug + tables, renders CreateTableForm, empty state, or TableCard list
- Updated `app/admin/page.tsx` — extended Promise.all with tables count query, updated restaurant select to include `has_printed_qr`, wired real `hasTables` and `hasPrintedQr` to OnboardingChecklist
- 14 new tests added: 7 for `createTable` (not-auth, no-restaurant, invalid 0, out-of-range 1000, float 1.5, success, duplicate, generic error) and 7 for `QrCodeDisplay` (skeleton before load, img after load, buttons disabled while loading, buttons enabled after, download calls recordQrPrint, print calls recordQrPrint)
- All 182 tests pass (21 test files)

### File List

- `supabase/migrations/20260517120000_add_restaurant_has_printed_qr.sql` (new)
- `types/app.ts` (modified — added `Table` interface; added `has_printed_qr` to `Restaurant`)
- `utils/generateQrUrl.ts` (new)
- `actions/restaurantActions.ts` (modified — added `recordQrPrint()`)
- `actions/tableActions.ts` (new)
- `components/admin/QrCodeDisplay.tsx` (new)
- `components/admin/TableCard.tsx` (new)
- `components/admin/CreateTableForm.tsx` (new)
- `app/admin/tables/page.tsx` (new)
- `app/admin/page.tsx` (modified — extended Promise.all, wired real hasTables/hasPrintedQr)
- `tests/unit/tables/tableActions.test.ts` (new)
- `tests/unit/tables/QrCodeDisplay.test.tsx` (new)

### Change Log

- 2026-05-17: Implemented story 3-1 — table creation, QR code generation/display, download/print, has_printed_qr migration, onboarding checklist wired up with real data
