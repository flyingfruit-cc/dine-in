# Story 4.2: Menu Browsing by Category with Availability Filtering

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to browse the menu by category and see only items available right now,
So that I can quickly find what I want without confusion about what I can actually order.

## Acceptance Criteria

**AC1** — Category tab bar scrolls to category on tap:
Given the menu has loaded
When the CategoryTabs render at the top of the page
Then each category appears as a tab; tapping a tab scrolls to that category's items
And the active tab has `border-bottom: 2px solid #FF6B35` (D1 design direction)

**AC2** — Available items render as MenuItemRow:
Given a category is displayed
When items render
Then each available item shows: 80×80px food photo (left), item name (max 2 lines), description (max 2 lines), right-aligned price
And items with no image show a grey placeholder gracefully — no broken img tag

**AC3** — Unavailable items are shown but NOT tappable:
Given an item has an availability schedule
When the menu renders outside the scheduled window
Then the item appears in the MenuItemRow unavailable variant ("Not available right now") with `opacity-60` and muted styling
And the item is NOT tappable — clicking or pressing Enter/Space does nothing (FR22)

**AC4** — Categories with all-unavailable items still appear:
Given all items in a category are currently unavailable
When the category renders
Then the category tab and its items still appear in unavailable state — the category is NOT hidden or removed

## Tasks / Subtasks

- [x] Task 1: Enforce "not tappable" on unavailable items in `components/customer/MenuItemRow.tsx` (AC: 3)
  - [x] Guard the `onClick` handler: `if (!isAvailable || !onTap) return` — never call `onTap` when unavailable
  - [x] Guard the `onKeyDown` handler: same guard — Enter/Space do nothing when `!isAvailable`
  - [x] Set `cursor-default` (not `cursor-pointer`) when `!isAvailable`
  - [x] Keep `tabIndex={0}` — screen readers can still navigate to the item to know it exists; interaction is just blocked
  - [x] `aria-disabled="true"` already specified in story 4-1 — verify it is on the element

- [x] Task 2: Verify `page.tsx` correctly computes availability and passes it to MenuItemRow (AC: 3, 4)
  - [x] Call `new Date()` ONCE in the Server Component and pass `now` into availability checks — do NOT call `new Date()` per-item (avoids clock skew mid-render)
  - [x] Pass `isAvailable={isItemAvailable(item.availability_schedule, now)}` to every `<MenuItemRow>`
  - [x] Do NOT filter out unavailable items from the items list — they must still render in unavailable state (AC3, AC4)
  - [x] Do NOT filter out categories where all items are unavailable — the category section and tab must still appear (AC4)
  - [x] Do NOT filter out items with `availability_schedule === null` — null schedule means always available (`isItemAvailable` already returns `true` for null)

- [x] Task 3: Verify CategoryTabs active tab styling is correct (AC: 1)
  - [x] Active tab: `border-b-2 border-accent text-accent` (maps to `#FF6B35` via design token — do NOT hardcode hex)
  - [x] Active tab indicator is `border-b-2` on the tab button itself, NOT a separate underline element
  - [x] Tab bar is `sticky top-0 z-10` so it stays visible while scrolling
  - [x] IntersectionObserver updates `activeTab` as customer scrolls (same pattern as `components/admin/MenuPreview.tsx` lines 72–102 — must already be in place from story 4-1)
  - [x] Verify `scroll-mt-14` on section elements accounts for the sticky tab bar height

- [x] Task 4: Add / extend unit tests in `tests/unit/customer/MenuItemRow.test.tsx` (AC: 2, 3)
  - [x] Test (new): unavailable item with `onTap` prop — click does NOT call `onTap`
  - [x] Test (new): unavailable item — Enter key does NOT call `onTap`
  - [x] Test (new): unavailable item — Space key does NOT call `onTap`
  - [x] Test (new): available item — click DOES call `onTap`
  - [x] Test (new): available item — Enter key DOES call `onTap`
  - [x] Test (new): item with `availability_schedule: null` → renders as available (no "Not available right now" label)
  - [x] Existing tests from story 4-1 must still pass — do not break them

### Review Findings (AI — 2026-05-17)

- [x] [Review][Patch] Price not right-aligned — resolved: text column is now `flex-1`, price moved to separate `shrink-0 self-start` sibling element to the right of the text column [components/customer/MenuItemRow.tsx]
- [x] [Review][Defer] Server timezone mismatch for availability checks — `isItemAvailable` uses server UTC clock; schedules are stored without timezone context. Pre-existing issue in `utils/isAvailable.ts`, out of scope for this story.

## Dev Notes

### Dependency: Story 4-1 Must Be Implemented First

Story 4-2 modifies files created in story 4-1. The following must already exist:
- `app/[restaurant_slug]/[table_number]/page.tsx` — SSR Server Component
- `components/customer/MenuItemRow.tsx` — props: `item: MenuItem`, `isAvailable: boolean`, `onTap?: () => void`
- `components/customer/CategoryTabs.tsx` — props: `categories: Category[]`, `hasUncategorized: boolean`
- `components/customer/MenuSkeleton.tsx` — skeleton loading state
- `tests/unit/customer/MenuItemRow.test.tsx` — tests from story 4-1 exist here; extend don't replace

### The "Not Tappable" Implementation

Story 4-1 built the `MenuItemRow` with `onTap?: () => void` prop and `onClick={onTap}`. Story 4-2 adds the guard to prevent invocation when unavailable.

**Correct implementation:**
```typescript
const handleTap = () => {
  if (!isAvailable || !onTap) return
  onTap()
}

// On the row element:
onClick={handleTap}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleTap()
  }
}}
```

**Cursor class:**
```typescript
className={`... ${isAvailable ? 'cursor-pointer' : 'cursor-default'}`}
```

**Note:** In story 4-1, story note says `onClick={onTap}` directly. This story changes that to `onClick={handleTap}` with the guard. This is a modification to existing code, not a rewrite.

### AC4: Never Filter Categories by Availability

The rendering in `page.tsx` must NOT remove categories or suppress items based on availability. The correct structure is:

```typescript
// CORRECT — all categories render, all items render, availability is only a display flag
{categories.map(cat => (
  <section key={cat.id} id={cat.id} className="scroll-mt-14 px-4 py-4">
    <h2 className="mb-3 text-base font-semibold text-text-primary">{cat.name}</h2>
    <ul className="flex flex-col">
      {categoryItems[cat.id]?.map(item => (
        <MenuItemRow
          key={item.id}
          item={item}
          isAvailable={isItemAvailable(item.availability_schedule, now)}
          // onTap is undefined here — wired in story 4-3
        />
      ))}
    </ul>
  </section>
))}

// WRONG — do NOT do this:
{categories.filter(cat => someItemsAvailable(cat.id)).map(...)}
{items.filter(item => isItemAvailable(item.availability_schedule, now)).map(...)}
```

The `isItemAvailable(null, now)` returns `true` (no schedule = always available) — verify `utils/isAvailable.ts` is used correctly, not `item.availability_schedule !== null`.

### `now` Must Be Computed Once Per Render

```typescript
// In page.tsx Server Component — compute ONCE
const now = new Date()

// Then pass to each item check:
isAvailable={isItemAvailable(item.availability_schedule, now)}
```

Do NOT call `new Date()` inside `MenuItemRow` or per-item — this would cause different items to have different "now" timestamps mid-render.

### Testing Pattern — Extend Not Replace

The test file `tests/unit/customer/MenuItemRow.test.tsx` was created in story 4-1. Story 4-2 adds new `describe` blocks or `it` cases to the SAME file. Do NOT create a new file.

Follow the existing test structure from the project (Vitest + React Testing Library). Look at `tests/unit/menu/CategoryManager.test.tsx` or similar for the import and mock patterns used.

For testing the "not tappable" behavior:
```typescript
it('unavailable item does not call onTap when clicked', async () => {
  const onTap = vi.fn()
  render(<MenuItemRow item={mockItem} isAvailable={false} onTap={onTap} />)
  await userEvent.click(screen.getByRole('button'))
  expect(onTap).not.toHaveBeenCalled()
})

it('unavailable item does not call onTap on Enter key', async () => {
  const onTap = vi.fn()
  render(<MenuItemRow item={mockItem} isAvailable={false} onTap={onTap} />)
  const row = screen.getByRole('button')
  row.focus()
  await userEvent.keyboard('{Enter}')
  expect(onTap).not.toHaveBeenCalled()
})
```

### What This Story Does NOT Change

- `lib/supabase/proxy.ts` — already updated in story 4-1; do NOT touch
- `components/customer/MenuSkeleton.tsx` — no changes needed
- `app/[restaurant_slug]/[table_number]/loading.tsx` — no changes needed
- All admin UI components — untouched
- `utils/isAvailable.ts` — used as-is; do NOT modify
- `stores/cartStore.ts` — story 4-3 (does not exist yet)
- `components/customer/ItemConfigSheet.tsx` — story 4-3 (does not exist yet)
- `onTap` prop wiring in `page.tsx` — remains `undefined` until story 4-3

### What Story 4-3 Will Add

Story 4-3 will add `onTap` wiring to `MenuItemRow` in `page.tsx` (which opens `ItemConfigSheet`). For now, `onTap` is passed as `undefined` — the row is navigable but inert for available items. This is correct behavior for story 4-2.

### Previous Story Intelligence (Story 4-1)

Story 4-1 built `MenuItemRow` with:
- `onClick={onTap}` directly — story 4-2 changes this to a guarded handler
- `aria-disabled="true"` when unavailable — keep, do NOT remove
- `tabIndex={0}` always — keep for keyboard navigation
- `role="button"` — keep

Watch for: the story 4-1 `MenuItemRow` task says `onClick={onTap}` but the intent was that unavailable items should not be tappable. If the developer missed adding the guard in story 4-1, story 4-2 must add it. Either way, the guard must be present after story 4-2.

### References

- [Source: _bmad-output/implementation-artifacts/4-1-qr-scan-anonymous-session-menu-load.md — Task 6] — `MenuItemRow` spec from story 4-1: props, layout, accessibility attributes, unavailable state
- [Source: _bmad-output/implementation-artifacts/4-1-qr-scan-anonymous-session-menu-load.md — Task 5] — `CategoryTabs` spec: IntersectionObserver pattern, active tab style, scroll-mt-14
- [Source: components/admin/MenuPreview.tsx lines 72–102] — IntersectionObserver pattern (already implemented in CategoryTabs from story 4-1)
- [Source: utils/isAvailable.ts] — `isItemAvailable(schedule: AvailabilitySchedule | null, now?: Date): boolean` — returns `true` for null schedule (always available)
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.2] — AC1–4 verbatim
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Component Strategy: MenuItemRow"] — `role="button"`, `aria-label="{name}, {price}"`, min 44px touch target; unavailable: muted + "Not available right now" label, NOT tappable
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Design Direction: D1"] — active tab: `border-bottom: 2px solid #FF6B35`; use `border-accent` token not hardcoded hex

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Added `handleTap` guard to `MenuItemRow` — blocks `onTap` when `!isAvailable`, switches cursor to `cursor-default` for unavailable items; existing `aria-disabled="true"` and `tabIndex={0}` preserved
- Task 2: `page.tsx` already correct from story 4-1 — `now` computed once, no filtering of items or categories, `isItemAvailable(item.availability_schedule, now)` passed to every `<MenuItemRow>`
- Task 3: `CategoryTabs` already correct from story 4-1 — `sticky top-0 z-10`, `border-b-2 border-accent text-accent` active style, IntersectionObserver in place, sections use `scroll-mt-14`
- Task 4: Added 4 new tests to `MenuItemRow.test.tsx` covering the guard behavior; existing 10 story 4-1 tests all pass; 201/201 total tests pass with zero regressions

### File List

- components/customer/MenuItemRow.tsx (modified)
- tests/unit/customer/MenuItemRow.test.tsx (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/4-2-menu-browsing-by-category-with-availability-filtering.md (modified)

Review follow-up files (4-1 findings resolved alongside 4-2):
- actions/customerActions.ts (new)
- components/customer/SessionInitializer.tsx (new)
- utils/customerMenu.ts (new)
- app/[restaurant_slug]/[table_number]/page.tsx (modified — session block removed, SessionInitializer added, NaN guard added, imports updated)
- components/customer/CategoryTabs.tsx (modified — UNCATEGORIZED_KEY now imported from utils/customerMenu)

## Change Log

- 2026-05-17: Implemented story 4.2 — unavailable item tap guard, cursor-default for unavailable, 4 new interaction tests (201/201 pass)
- 2026-05-17: Addressed code review finding — price right-aligned via flex-1 text column + shrink-0 price sibling (201/201 pass)
