# Story 2.4: Item Availability Scheduling

Status: done

## Story

As a restaurant owner,
I want to configure day and time window availability for a menu item,
so that items like lunch specials only appear on the customer menu during the correct hours.

## Acceptance Criteria

**AC1** — AvailabilitySchedule component renders in edit form:
Given an owner is editing a menu item at `/admin/menu/[item_id]`
When they scroll to the availability section
Then the `AvailabilitySchedule` component renders below the Variants section with:
- An "Enable availability schedule" toggle/checkbox (unchecked = always available)
- When enabled: a row of 7 day-of-week toggle buttons (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- When enabled: a start time input and end time input (both `type="time"`)
- Day buttons and time inputs are disabled / hidden when the toggle is off

**AC2** — Save availability schedule:
Given an owner enables the schedule, selects days (e.g., Mon–Fri), and sets a time window (e.g., 11:00–14:00)
When the auto-save debounce fires
Then `availability_schedule` is stored as JSONB in `menu_items` containing the selected days array and start/end time strings
And the schedule persists and is pre-populated correctly when the owner returns to the item edit page

**AC3** — No schedule means always available:
Given no availability schedule is configured (schedule toggle is off, `availability_schedule` is NULL in DB)
When a customer views the menu
Then the item is treated as available at all times (`isItemAvailable(null, now)` returns `true`)

**AC4** — Availability utility correctly computes availability:
Given an item has a schedule (e.g., Mon–Fri 11:00–14:00)
When `isItemAvailable(schedule, now)` is called with a time outside the window (e.g., Saturday 15:00)
Then it returns `false`
And when called with a time inside the window (e.g., Monday 12:30)
Then it returns `true`
Note: Rendering the customer-facing `MenuItemRow` unavailable state is Story 4.2 scope; this story delivers the data structure and the utility that 4.2 will consume.

## Tasks / Subtasks

- [x] Task 1: Add DB migration for `availability_schedule` column (AC: 2, 3)
  - [x] Create `supabase/migrations/20260516100000_add_menu_item_availability.sql`
  - [x] SQL: `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS availability_schedule jsonb DEFAULT NULL;`
  - [x] Apply via Supabase MCP `apply_migration` tool
  - [x] Note: NULL (not `'[]'`) means "always available" — opposite convention from `variants`

- [x] Task 2: Add TypeScript types in `types/app.ts` (AC: 1, 2, 3, 4)
  - [x] Add `DayOfWeek` type: `'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'`
  - [x] Add `AvailabilitySchedule` interface: `{ days: DayOfWeek[]; start_time: string; end_time: string }`
  - [x] Add `availability_schedule?: AvailabilitySchedule | null` to `MenuItem`, `MenuItemCreate`, `MenuItemUpdate`
  - [x] Note: `MenuItem.availability_schedule` should be `AvailabilitySchedule | null` (nullable, not required)

- [x] Task 3: Create `utils/isAvailable.ts` utility (AC: 3, 4)
  - [x] Export `isItemAvailable(schedule: AvailabilitySchedule | null, now?: Date): boolean`
  - [x] Returns `true` when schedule is null (always available)
  - [x] Returns `false` when `days` is empty
  - [x] Checks current day (using JS `Date.getDay()` mapped to `DayOfWeek`) is in `schedule.days`
  - [x] Checks current time "HH:MM" is within `[start_time, end_time)` range
  - [x] Write unit tests in `tests/unit/utils/isAvailable.test.ts`

- [x] Task 4: Create `components/admin/AvailabilitySchedule.tsx` Client Component (AC: 1, 2)
  - [x] Props: `schedule: AvailabilitySchedule | null, onChange: (schedule: AvailabilitySchedule | null) => void`
  - [x] Controlled component — no local state; all mutations call `onChange`
  - [x] "Enable availability schedule" checkbox at top
    - [x] When unchecked → `onChange(null)`
    - [x] When checked (was null) → `onChange({ days: [], start_time: '09:00', end_time: '17:00' })`
  - [x] When schedule is active (non-null):
    - [x] 7 day toggle buttons: Mon Tue Wed Thu Fri Sat Sun (abbreviations)
    - [x] Each button: toggle the day in/out of `schedule.days` array and call `onChange`
    - [x] Start time input: `type="time"` with label "From", calls `onChange({ ...schedule, start_time: value })`
    - [x] End time input: `type="time"` with label "Until", calls `onChange({ ...schedule, end_time: value })`
  - [x] Day buttons min 44px tap target, visually distinct when active (e.g., accent background)
  - [x] No toasts — component provides no standalone feedback; save status from `MenuItemForm`
  - [x] Write unit tests in `tests/unit/menu/AvailabilitySchedule.test.tsx`

- [x] Task 5: Integrate `AvailabilitySchedule` into `components/admin/MenuItemForm.tsx` (AC: 1, 2)
  - [x] Add `availabilitySchedule` state: `useState<AvailabilitySchedule | null>(item?.availability_schedule ?? null)`
  - [x] Add `availability_schedule: availabilitySchedule` to `textData` object inside `doSave()`
  - [x] Add `availabilitySchedule` to `useEffect` dependency array (trigger auto-save on change)
  - [x] Render `<AvailabilitySchedule schedule={availabilitySchedule} onChange={setAvailabilitySchedule} />` in a labeled section below the `<VariantEditor />` section
  - [x] Update unit tests in `tests/unit/menu/MenuItemForm.test.tsx`

- [x] Task 6: Update `app/admin/menu/[item_id]/page.tsx` to normalize `availability_schedule` (AC: 2)
  - [x] Add `availability_schedule` cast alongside the existing `variants` cast
  - [x] Cast: `availability_schedule: item.availability_schedule as AvailabilitySchedule | null`
  - [x] Import `AvailabilitySchedule` from `@/types/app`

### Review Findings

- [x] [Review][Patch] Empty string propagated when time input cleared — `handleStartTime`/`handleEndTime` pass `""` to `onChange`; written to DB on next auto-save; `isItemAvailable` string compare always fails → item never available [components/admin/AvailabilitySchedule.tsx: handleStartTime/handleEndTime]
- [x] [Review][Defer] Timezone mismatch: `isItemAvailable` uses process/browser local TZ, not restaurant's configured TZ [utils/isAvailable.ts] — deferred, MVP scope
- [x] [Review][Defer] No UI warning when schedule enabled with `days: []` — item silently unavailable with no owner feedback [components/admin/AvailabilitySchedule.tsx] — deferred, UX polish
- [x] [Review][Defer] No validation when `start_time >= end_time` — produces permanently-unavailable window with no error/warning [components/admin/AvailabilitySchedule.tsx] — deferred, UX polish
- [x] [Review][Defer] Bare `as AvailabilitySchedule | null` cast at page.tsx boundary — no runtime JSONB shape validation [app/admin/menu/[item_id]/page.tsx] — deferred, pre-existing pattern

## Dev Notes

### Schema Decision: NULL vs Empty Object

`availability_schedule` uses `DEFAULT NULL` (not `DEFAULT '[]'::jsonb NOT NULL` like `variants`). NULL is the correct sentinel for "no schedule configured / always available". An empty object or `{}` would be ambiguous. This distinction matters in `isItemAvailable`:

```sql
-- Migration
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS availability_schedule jsonb DEFAULT NULL;
```

Follow the same Supabase MCP `apply_migration` approach used in 2-3 (`20260511100000_add_menu_item_variants.sql`).

### TypeScript Types to Add in `types/app.ts`

```typescript
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface AvailabilitySchedule {
  days: DayOfWeek[]      // e.g., ['mon', 'tue', 'wed', 'thu', 'fri']
  start_time: string     // "HH:MM" 24-hour, e.g. "11:00"
  end_time: string       // "HH:MM" 24-hour, e.g. "14:00"
}
```

Then extend existing interfaces:
```typescript
export interface MenuItem {
  // ...existing fields...
  availability_schedule: AvailabilitySchedule | null  // null = always available
}

export interface MenuItemCreate {
  // ...existing fields...
  availability_schedule?: AvailabilitySchedule | null
}

export interface MenuItemUpdate {
  // ...existing fields...
  availability_schedule?: AvailabilitySchedule | null
}
```

Unlike `variants`, `MenuItem.availability_schedule` is nullable because NULL carries meaning ("always available"). The Supabase JS client returns `null` for NULL columns, which is correct.

### No New Server Actions Needed

Same pattern as story 2-3. `updateMenuItem` and `createMenuItem` already pass the data object through to Supabase directly. Adding `availability_schedule` to `MenuItemUpdate`/`MenuItemCreate` is sufficient. The JSONB column accepts it transparently.

### `isItemAvailable` Utility — `utils/isAvailable.ts`

```typescript
import type { AvailabilitySchedule, DayOfWeek } from '@/types/app'

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

export function isItemAvailable(
  schedule: AvailabilitySchedule | null,
  now = new Date()
): boolean {
  if (!schedule) return true
  if (!schedule.days.length) return false

  const dayOfWeek = DAY_MAP[now.getDay()]
  if (!schedule.days.includes(dayOfWeek)) return false

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  return currentTime >= schedule.start_time && currentTime < schedule.end_time
}
```

**Why `< end_time` not `<= end_time`:** Half-open interval `[start, end)` is conventional for time ranges — an item ending at 14:00 is not available at 14:00. This matches customer expectations for "lunch until 2pm."

**Time comparison via string sort:** "HH:MM" lexicographic comparison works correctly for 24-hour time strings (both components zero-padded). No date library needed.

**`now` as optional parameter:** Enables deterministic unit testing without date mocking.

### AvailabilitySchedule Component — Controlled Component Pattern

Mirrors `VariantEditor` exactly — no local state, all mutations produce a new value and call `onChange`. Parent owns state.

```typescript
interface AvailabilityScheduleProps {
  schedule: AvailabilitySchedule | null
  onChange: (schedule: AvailabilitySchedule | null) => void
}
```

Default values when enabling from null: `{ days: [], start_time: '09:00', end_time: '17:00' }`. These are arbitrary sensible defaults — owner will adjust.

Day button UX: use `<button type="button">` (not checkbox inputs) — easier to style as pill/badge toggles. Active state: `bg-accent text-white`. Inactive state: `bg-surface border border-border text-text-secondary`. Min 44px height for tap targets.

Time inputs: `type="time"` (native browser time picker). Use `defaultValue` pattern? No — controlled (`value` + `onChange`). Labels: "From" and "Until" (not "Start time" / "End time" — shorter, friendlier).

```typescript
const DAY_LABELS: { key: DayOfWeek; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]
```

### Auto-Save Integration in MenuItemForm

```typescript
const [availabilitySchedule, setAvailabilitySchedule] = useState<AvailabilitySchedule | null>(
  item?.availability_schedule ?? null
)

// Inside doSave — add to textData:
const textData = {
  name: name.trim(),
  description: description.trim() || null,
  price_cents: priceCents,
  category_id: categoryId,
  variants,
  availability_schedule: availabilitySchedule,  // ← add this
}

// Add to useEffect deps:
useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current)
  if (!name.trim()) return
  timerRef.current = setTimeout(() => { void doSave() }, 2000)
  return () => { if (timerRef.current) clearTimeout(timerRef.current) }
}, [name, description, priceCents, categoryId, pendingImageFile, imageRemoved, variants, availabilitySchedule])
//                                                                                        ↑ add this
```

Import `AvailabilitySchedule` type from `@/types/app` and add import for `AvailabilitySchedule` component.

### page.tsx Normalization

The Supabase JS client returns `availability_schedule` as `Json | null` from the generated types. Cast it at the boundary, alongside the existing `variants` cast:

```typescript
const normalizedItem: MenuItem = {
  ...item,
  variants: (item.variants ?? []) as VariantGroup[],
  availability_schedule: item.availability_schedule as AvailabilitySchedule | null,
} as MenuItem
```

Import `AvailabilitySchedule` from `@/types/app` (already imports `VariantGroup`).

### Supabase Client Import Path

**Critical reminder from story 2-3 dev notes:** Architecture doc says `utils/supabase/` but the actual codebase uses `lib/supabase/`:
- Server Actions → `import { createClient } from '@/lib/supabase/server'`
- Client Components → `import { createClient } from '@/lib/supabase/client'`
- `AvailabilitySchedule` is a pure controlled component — no Supabase client needed

### Testing Patterns

**`tests/unit/utils/isAvailable.test.ts`** (jsdom or node — no DOM needed):
```typescript
import { isItemAvailable } from '@/utils/isAvailable'

// Test cases:
// - null schedule → always returns true
// - empty days array → returns false
// - day not in schedule → returns false
// - day in schedule, time before start_time → returns false
// - day in schedule, time at start_time → returns true
// - day in schedule, time within window → returns true
// - day in schedule, time at end_time → returns false (half-open)
// - day in schedule, time after end_time → returns false
// - midnight edge case: start_time "00:00", end_time "23:59"
// - overnight schedule NOT supported (start > end) — document this limitation
```

Create test directory: `tests/unit/utils/` (likely new directory — check with `ls tests/unit/`).

**`tests/unit/menu/AvailabilitySchedule.test.tsx`** (jsdom):
```typescript
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { AvailabilitySchedule } from '@/components/admin/AvailabilitySchedule'

// Test cases:
// - Renders "Enable availability schedule" checkbox unchecked when schedule is null
// - Day buttons and time inputs NOT rendered when schedule is null
// - Checking the enable checkbox calls onChange with default schedule (days: [], start_time: '09:00', end_time: '17:00')
// - Unchecking the enable checkbox calls onChange(null)
// - Clicking a day button adds that day to schedule.days and calls onChange
// - Clicking an active day button removes it from schedule.days and calls onChange
// - Changing start time input calls onChange with updated start_time
// - Changing end time input calls onChange with updated end_time
// - All 7 day buttons are rendered when schedule is active
```

**`tests/unit/menu/MenuItemForm.test.tsx` additions:**
- Mock `AvailabilitySchedule` component (same pattern as `VariantEditor` mock)
- Verify `AvailabilitySchedule` renders in the form
- Verify changing availability schedule triggers auto-save with `availability_schedule` in payload

AvailabilitySchedule mock for MenuItemForm tests:
```typescript
vi.mock('@/components/admin/AvailabilitySchedule', () => ({
  AvailabilitySchedule: ({ onChange }: { onChange: (s: unknown) => void }) => (
    <button onClick={() => onChange({ days: ['mon'], start_time: '11:00', end_time: '14:00' })}>
      mock-availability-change
    </button>
  ),
}))
```

### What This Story Does NOT Change

- `actions/menuActions.ts` — no changes needed (JSONB pass-through, same as variants)
- `app/admin/menu/page.tsx` — category list page, no availability display
- `components/admin/VariantEditor.tsx` — no change
- `components/admin/CategoryManager.tsx` — no change
- Customer-facing `MenuItemRow` unavailable state rendering — Story 4.2 scope
- Menu preview showing unavailable items — Story 2.6 scope (but `isItemAvailable` from this story will be used there)
- `is_published` field — Story 2.7 scope

### Overnight Schedules Not Supported (MVP)

The half-open interval `[start_time, end_time)` assumes `start_time < end_time` (no wrap past midnight). An overnight schedule like 22:00–02:00 is **not supported** in MVP — the string comparison would fail. This is acceptable: the primary use case is lunch/dinner specials, not overnight availability. Document this constraint in a code comment in `isAvailable.ts`.

### References

- Story 2-3 dev notes — JSONB pattern, controlled component pattern, testing pattern: `_bmad-output/implementation-artifacts/2-3-item-variants-pricing.md`
- `getAuthContext()` helper: `actions/menuActions.ts:11` (no changes needed — reference only)
- `MenuItemForm` auto-save pattern: `components/admin/MenuItemForm.tsx:118` (useEffect + timerRef)
- `VariantEditor` controlled component pattern: `components/admin/VariantEditor.tsx` (mirror this exactly)
- Previous migration pattern: `supabase/migrations/20260511100000_add_menu_item_variants.sql`
- UX spec form patterns: `_bmad-output/planning-artifacts/ux-design-specification.md` § "Form Patterns"
- UX spec — "No toasts": `_bmad-output/planning-artifacts/ux-design-specification.md` § "No toast notifications"
- Architecture — anti-patterns: `_bmad-output/planning-artifacts/architecture.md` § "Anti-Patterns to Avoid"
- FR8: `_bmad-output/planning-artifacts/epics.md` — "Restaurant owner can configure an availability schedule for a menu item (days and time windows)"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks complete; 123 unit tests passing (15 test files — no regressions)
- DB column applied via Supabase MCP (`availability_schedule jsonb DEFAULT NULL`)
- `DayOfWeek` union type + `AvailabilitySchedule` interface added to `types/app.ts`; field added to `MenuItem` (non-optional nullable), `MenuItemCreate`, `MenuItemUpdate`
- `utils/isAvailable.ts` exports `isItemAvailable` with half-open interval `[start, end)` — 12 unit tests covering null schedule, empty days, day mismatch, boundary times, and edge cases
- `AvailabilitySchedule` component is a pure controlled component (no local state); enable checkbox toggles null↔default; 7 day pill buttons with `aria-pressed`; From/Until `type="time"` inputs — 12 unit tests
- `MenuItemForm` wires `availabilitySchedule` state into `doSave` payload and `useEffect` deps; 3 new test cases verify rendering and payload inclusion
- `page.tsx` normalizes `availability_schedule` from Supabase `Json` to `AvailabilitySchedule | null` at the boundary
- Actions/menuActions unchanged — JSONB pass-through handles the new field transparently
- Customer-facing `MenuItemRow` unavailable rendering is Story 4.2 scope; `isItemAvailable` from `utils/isAvailable.ts` is ready for consumption there

### File List

- `supabase/migrations/20260516100000_add_menu_item_availability.sql` (new)
- `types/app.ts` (modified — DayOfWeek, AvailabilitySchedule types; availability_schedule field on MenuItem/MenuItemCreate/MenuItemUpdate)
- `utils/isAvailable.ts` (new)
- `components/admin/AvailabilitySchedule.tsx` (new)
- `components/admin/MenuItemForm.tsx` (modified — availabilitySchedule state, doSave payload, useEffect deps, JSX render, AvailabilitySchedule import)
- `app/admin/menu/[item_id]/page.tsx` (modified — availability_schedule normalization cast)
- `tests/unit/utils/isAvailable.test.ts` (new — 12 tests)
- `tests/unit/menu/AvailabilitySchedule.test.tsx` (new — 12 tests)
- `tests/unit/menu/MenuItemForm.test.tsx` (modified — AvailabilitySchedule mock + 3 new test cases)

### Change Log

- 2026-05-16: Story 2.4 complete — DB migration applied, DayOfWeek/AvailabilitySchedule types added, isItemAvailable utility built with 12 tests, AvailabilitySchedule component built as controlled component with 12 tests, integrated into MenuItemForm (state + auto-save + useEffect deps + JSX), page.tsx normalized. 123/123 tests passing.
