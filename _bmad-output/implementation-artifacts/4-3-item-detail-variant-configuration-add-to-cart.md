# Story 4.3: Item Detail, Variant Configuration & Add to Cart

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to tap a menu item, see its full details and variants in a bottom sheet, and add it to my order,
so that I can configure exactly what I want before committing.

## Acceptance Criteria

**AC1** — Bottom sheet opens on available item tap:
Given a customer taps an available `MenuItemRow`
When the tap registers
Then `ItemConfigSheet` slides up as a bottom sheet containing: drag handle, food photo (16:9 full-width), item name + price, description, variant selectors (if applicable), and "Add to Order" CTA
And focus moves to the sheet heading and a focus trap is active while the sheet is open

**AC2** — Variant selectors shown; selecting one updates price:
Given an item has variants
When the sheet renders
Then each variant group and its options (up to 6) are shown as selectable buttons — auto-select the first option per group on open
And selecting a different option highlights it and updates the displayed price to that option's `price_cents`

**AC3** — Add to Order → cartStore updated, CartBar appears:
Given a customer taps "Add to Order"
When the item (with selected variants) is added to `cartStore`
Then `ItemConfigSheet` dismisses and `CartBar` appears at the bottom showing updated item count and total
And focus returns to the triggering `MenuItemRow`
And each "Add to Order" tap adds exactly one unit — no quantity stepper; same item tapped again = second line entry

**AC4** — Item without variants: no variant section shown:
Given an item has no variants (`item.variants` is an empty array)
When the sheet renders
Then no variant section is shown — sheet displays only photo, name, price, description, CTA

**AC5** — Dismiss without adding:
Given the customer dismisses the sheet via the drag handle or tap-outside (backdrop click)
When the sheet closes
Then no item is added to `cartStore`

---

## Tasks / Subtasks

- [x] Task 0: Install Zustand (AC: all — prerequisite)
  - [x] Run `npm install zustand` — Zustand is NOT in package.json yet; must be added before any store code compiles
  - [x] Verify `"zustand"` appears in `package.json` dependencies after install

- [x] Task 1: Add `CartItem` and `SelectedVariant` types to `types/app.ts` (AC: 3)
  - [x] Add `SelectedVariant` interface: `{ groupId, groupName, optionId, optionName, price_cents }`
  - [x] Add `CartItem` interface: `{ cartItemId, menuItemId, name, price_cents, selectedVariants: SelectedVariant[] }`
  - [x] Add `EnrichedMenuItem` type: `MenuItem & { isAvailable: boolean }` — used by `CustomerMenuClient` props

- [x] Task 2: Create `stores/cartStore.ts` (AC: 3)
  - [x] Create file at exactly `stores/cartStore.ts` (NOT inside `components/` or `app/`)
  - [x] Export `useCartStore` using `create<CartStore>()` from `zustand` — follow the architecture store pattern exactly
  - [x] Store state: `items: CartItem[]`
  - [x] Store actions: `addItem(item: CartItem)`, `removeItem(cartItemId: string)`, `clearCart()`
  - [x] `addItem`: `set((state) => ({ items: [...state.items, item] }))` — NEVER mutate state directly
  - [x] `removeItem`: filter by `cartItemId` — needed for story 4-4 cart review; add now to avoid re-creating the store later
  - [x] Do NOT add `'use client'` directive to the store file — it is not a component

- [x] Task 3: Create `components/customer/ItemConfigSheet.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] `'use client'` directive at top
  - [x] Props: `item: MenuItem | null`, `onClose: () => void`
  - [x] Use native HTML `<dialog>` element for built-in focus trap, Escape key (`cancel` event), and backdrop
  - [x] `useRef<HTMLDialogElement>(null)` — call `dialogRef.current.showModal()` when `item !== null`, `dialogRef.current.close()` when `item === null`
  - [x] Capture `document.activeElement` before opening dialog; restore focus to it after close (`previousFocusRef`)
  - [x] `useEffect` on `item` changes: open/close dialog and track previous focus element
  - [x] `useEffect` for `cancel` event listener (Escape): `e.preventDefault(); onClose()`
  - [x] Backdrop click: `onClick` on `<dialog>` element — if `e.target === dialogRef.current` then `onClose()`
  - [x] Layout inside dialog: drag handle bar (centered `div`, `bg-border`, `rounded-full`), 16:9 photo or grey placeholder, item name (`title-2` scale: 22px/600), price display, description (`text-secondary`), variant section (conditional), "Add to Order" CTA
  - [x] Local state: `selectedOptions: Record<string, string>` — key is `variantGroup.id`, value is `variantOption.id`
  - [x] On dialog open (`item` becomes non-null): reset `selectedOptions` to first option of each group
  - [x] Displayed price: compute from selected options — `selectedOptions` maps to the matching `VariantOption.price_cents`; if no variants, use `item.price_cents`
  - [x] Variant selector: for each `VariantGroup`, render group name + `<ul>` of option buttons; selected option gets `border-accent` / `bg-accent/10` highlight; unselected get `border-border`
  - [x] "Add to Order" handler: build `CartItem` → call `useCartStore.getState().addItem(cartItem)` → call `onClose()`
  - [x] "Add to Order" CTA: full-width, `bg-accent text-white`, min-height 48px, `aria-label="Add to Order"`
  - [x] Dialog accessibility: `aria-modal="true"`, `aria-labelledby` pointing to item name heading `id`
  - [x] Sheet heading (`<h2 id="sheet-title">`) receives focus after dialog opens — `tabIndex={-1}` + `requestAnimationFrame` focus
  - [x] CSS: dialog positioned at bottom — `fixed bottom-0 left-0 right-0 rounded-t-2xl` + `backdrop:bg-black/50`
  - [x] `padding-bottom: env(safe-area-inset-bottom)` on the bottom action area for iOS notch

- [x] Task 4: Create `components/customer/CartBar.tsx` (AC: 3)
  - [x] `'use client'` directive at top
  - [x] No props — reads directly from `useCartStore`
  - [x] Hidden (return `null`) when `items.length === 0`
  - [x] Layout: `role="complementary"`, `aria-label={`Cart: ${count} items, ${formatPrice(total)}`}`
  - [x] Anatomy: item count pill (left, `bg-white/20 rounded-full`) · "Review Order" (centre, font-semibold) · total price (right, monospaced)
  - [x] `aria-live="polite"` on the count pill so screen readers announce changes
  - [x] Position: `fixed bottom-0 left-0 right-0`, `bg-accent text-white`, `padding-bottom: env(safe-area-inset-bottom)`
  - [x] `onClick`: stub — story 4-4 wires cart review navigation; no-op for now
  - [x] Total price: sum of `item.price_cents` across all `items` in cartStore; display via `formatPrice(total)`

- [x] Task 5: Create `components/customer/CustomerMenuClient.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] `'use client'` directive at top
  - [x] Props: `categories: Category[]`, `items: EnrichedMenuItem[]`, `hasUncategorized: boolean`, `restaurantName: string`
  - [x] Local state: `selectedItem: MenuItem | null` (controls `ItemConfigSheet` open/close)
  - [x] Import and render `CategoryTabs` (same props as in current `page.tsx`: `categories`, `hasUncategorized`)
  - [x] Render restaurant header
  - [x] Re-implement the category section rendering from current `page.tsx` — group `items` by `category_id`, render `<section>` blocks with `MenuItemRow`
  - [x] Pass `onTap={() => setSelectedItem(item)}` to each `<MenuItemRow>` where `isAvailable === true`; pass `onTap={undefined}` (omit) when unavailable
  - [x] Import and render `ItemConfigSheet` with `item={selectedItem}` and `onClose={() => setSelectedItem(null)}`
  - [x] Import and render `CartBar` (always — it self-hides when empty)
  - [x] The uncategorized section (id=`UNCATEGORIZED_KEY`) — import from `@/utils/customerMenu`
  - [x] Category section `id` and `className="scroll-mt-14"` preserved for IntersectionObserver
  - [x] Items NOT filtered by availability — unavailable items render with `isAvailable={false}` and `onTap={undefined}`

- [x] Task 6: Refactor `app/[restaurant_slug]/[table_number]/page.tsx` (AC: 1)
  - [x] Keep all server-side data fetching exactly as-is
  - [x] Compute `enrichedItems`: `items.map(item => ({ ...item, isAvailable: isItemAvailable(item.availability_schedule, now) }))`
  - [x] Replace the interactive JSX with a single `<CustomerMenuClient>` call
  - [x] `SessionInitializer` stays in `page.tsx`
  - [x] Removed direct imports of `CategoryTabs`, `MenuItemRow`, `UNCATEGORIZED_KEY` (moved to `CustomerMenuClient`)
  - [x] `isItemAvailable` import kept (used to compute `enrichedItems` server-side)

- [x] Task 7: Unit tests (AC: all)
  - [x] Create `tests/unit/customer/cartStore.test.ts` — 7 tests covering addItem, removeItem, clearCart, separate line entries
  - [x] Create `tests/unit/customer/ItemConfigSheet.test.tsx` — 13 tests covering render, variants, price update, Add to Order, backdrop dismiss
  - [x] Create `tests/unit/customer/CartBar.test.tsx` — 7 tests covering empty state, count, label, total, aria-label

### Review Findings (AI — 2026-05-18)

- [x] [Review][Decision] Multi-group variant pricing semantics — resolved: Option A (first-group-wins). Only the first variant group is price-bearing; subsequent groups are label/flavor only. This is a data-entry constraint to document and enforce at the admin level. No code change required. [components/customer/ItemConfigSheet.tsx:13–23]
- [x] [Review][Patch] Add `role="dialog"` to `<dialog>` element — applied [components/customer/ItemConfigSheet.tsx]
- [x] [Review][Patch] Move `env(safe-area-inset-bottom)` from CTA button to content container — applied; safe-area padding now on the content div with `max(1rem, env(safe-area-inset-bottom))` [components/customer/ItemConfigSheet.tsx]
- [x] [Review][Patch] Fix `CartBar` aria-label incorrect plural — applied; `${count} ${count === 1 ? 'item' : 'items'}` [components/customer/CartBar.tsx]
- [x] [Review][Defer] CartBar `<div>` not keyboard-activatable — `role="complementary"` on a `<div>` with `onClick` is not focusable/activatable via keyboard; must be remedied in story 4-4 when cart review navigation is implemented — deferred, next-story concern [components/customer/CartBar.tsx:14]
- [x] [Review][Defer] Uncategorized section may duplicate items if any category has `id: null` in DB — pre-existing data quality guard; categories are UUID-keyed in Supabase so effectively impossible in practice — deferred, pre-existing
- [x] [Review][Defer] Menu item availability computed at SSR time only — items can become unavailable mid-session without UI update; pre-existing limitation tracked since story 4-2 — deferred, pre-existing [app/[restaurant_slug]/[table_number]/page.tsx]
- [x] [Review][Defer] `crypto.randomUUID()` unavailable on HTTP — only affects local dev over plain HTTP; production QR codes always point to HTTPS — deferred, dev-environment only
- [x] [Review][Defer] Empty variant group (`options: []`) renders group label with no selectable options — data quality edge case; restaurant admin UI should prevent empty groups — deferred, pre-existing

---

## Dev Notes

### Critical: Zustand Not Installed

**Zustand is NOT in `package.json`** — the architecture specifies it, but it has not been installed. Run `npm install zustand` before writing any store code or the TypeScript compiler and bundler will error.

### Architecture Pattern: Zustand Store

From `_bmad-output/planning-artifacts/architecture.md` (Communications Patterns section):
```typescript
// Exact pattern required — no deviations
const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  clearCart: () => set({ items: [] }),
}))
```
- One store per domain — `cartStore.ts`, `orderStore.ts` (separate files)
- Actions defined INSIDE the store factory — not outside
- No direct state mutation — always `set()`
- Store file location: `stores/cartStore.ts` (root-level `stores/` dir, already has `.gitkeep`)
- When accessing the store inside Realtime callbacks: use `useCartStore.getState().addItem()`. Inside components: use `useCartStore()` hook normally. (This story only uses hook access inside components.)

### Architecture Pattern: Client Component Islands

`page.tsx` is a Server Component. It cannot pass functions as props to Client Components (not serializable). The `onTap` wiring from story 4-2 notes requires a Client Component wrapper.

**Required refactoring:**
- Extract all interactive rendering (CategoryTabs, MenuItemRow sections, ItemConfigSheet, CartBar) into `CustomerMenuClient.tsx` (`'use client'`)
- `page.tsx` fetches data server-side, computes `isAvailable` per item, passes serializable data to `CustomerMenuClient`
- `SessionInitializer` stays in `page.tsx` — Server Components can render Client Components directly

This is the "Client Component island" pattern specified in the architecture:
> "Client Component islands for CartBar, ItemConfigSheet, order submission"

### Bottom Sheet Implementation: Native `<dialog>`

Use the native HTML `<dialog>` element — not a `div` with manual positioning. Reasons:
- Built-in focus trap (Tab stays within dialog)
- `cancel` event fires on `Escape` key
- `::backdrop` pseudo-element for overlay
- No additional library needed (none in package.json)

**Key `<dialog>` behavior:**
```tsx
// Open
dialogRef.current?.showModal()  // NOT .show() — showModal() enables focus trap + backdrop

// Close  
dialogRef.current?.close()

// Escape key
dialog.addEventListener('cancel', (e) => {
  e.preventDefault()  // prevent dialog from self-closing before we update state
  onClose()
})

// Backdrop click (tap outside)
// onClick fires on <dialog> itself when user clicks the ::backdrop area
const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === dialogRef.current) onClose()
}
```

**CSS positioning at bottom (not centered):**
The native `<dialog>` is centered by default. Override with Tailwind + global CSS:
```css
/* In globals.css or via Tailwind arbitrary values */
dialog {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0;
  max-width: 100%;
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
  padding: 0;
  border: none;
}
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}
```
Or use inline `style={{ ... }}` on the dialog element. Do NOT use `top: auto` alone — `position: fixed; bottom: 0` is required.

### Focus Management

```tsx
const previousFocusRef = useRef<HTMLElement | null>(null)
const headingRef = useRef<HTMLHeadingElement>(null)

useEffect(() => {
  if (item) {
    previousFocusRef.current = document.activeElement as HTMLElement
    dialogRef.current?.showModal()
    // Focus to sheet heading after open
    requestAnimationFrame(() => headingRef.current?.focus())
  } else {
    dialogRef.current?.close()
    previousFocusRef.current?.focus()
    previousFocusRef.current = null
  }
}, [item])
```

`requestAnimationFrame` is needed to focus the heading AFTER the dialog has fully opened and the DOM has settled.

### Price Display Logic in ItemConfigSheet

```typescript
// Compute effective displayed price from selected options
function getEffectivePrice(item: MenuItem, selectedOptions: Record<string, string>): number {
  if (!item.variants.length) return item.price_cents
  // Find the selected option for any group and use its price
  for (const group of item.variants) {
    const selectedOptionId = selectedOptions[group.id]
    if (selectedOptionId) {
      const option = group.options.find(o => o.id === selectedOptionId)
      if (option) return option.price_cents
    }
  }
  return item.price_cents  // fallback
}
```

Note: Each `VariantGroup` has one selection (not additive pricing per group). The selected option's `price_cents` IS the item price.

### CartItem Construction in ItemConfigSheet

```typescript
const handleAddToOrder = () => {
  if (!item) return
  const selectedVariantsList: SelectedVariant[] = item.variants
    .map(group => {
      const optionId = selectedOptions[group.id]
      const option = group.options.find(o => o.id === optionId)
      if (!option) return null
      return {
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        price_cents: option.price_cents,
      }
    })
    .filter((v): v is SelectedVariant => v !== null)

  const cartItem: CartItem = {
    cartItemId: crypto.randomUUID(),
    menuItemId: item.id,
    name: item.name,
    price_cents: getEffectivePrice(item, selectedOptions),
    selectedVariants: selectedVariantsList,
  }

  useCartStore.getState().addItem(cartItem)
  onClose()
}
```

### CartBar Total Calculation

```typescript
const items = useCartStore(state => state.items)
const count = items.length
const total = items.reduce((sum, item) => sum + item.price_cents, 0)
```

Use `formatPrice(total)` from `@/utils/formatPrice` for display. Price is always `price_cents` (integer cents) — never `price: float`.

### EnrichedMenuItem Shape

```typescript
// In types/app.ts — add alongside CartItem
export type EnrichedMenuItem = MenuItem & { isAvailable: boolean }
```

Used in `CustomerMenuClient` props. `page.tsx` computes:
```typescript
const enrichedItems: EnrichedMenuItem[] = items.map(item => ({
  ...item,
  isAvailable: isItemAvailable(item.availability_schedule, now),
}))
```

### What This Story Does NOT Change

- `utils/isAvailable.ts` — used as-is; DO NOT modify
- `components/customer/MenuItemRow.tsx` — props interface unchanged; `onTap` was already optional
- `components/customer/CategoryTabs.tsx` — unchanged
- `components/customer/MenuSkeleton.tsx` — unchanged
- `components/customer/SessionInitializer.tsx` — unchanged; stays in `page.tsx`
- `actions/customerActions.ts` — unchanged
- All admin UI components — untouched
- `tests/unit/customer/MenuItemRow.test.tsx` — do NOT modify; all 14 existing tests must continue to pass

### What Story 4-4 Will Add

- `CartBar` `onClick` navigation to the order review screen (stub left as no-op in this story)
- `CartReviewPage` — does not exist yet; do NOT create a placeholder
- `removeItem` usage in cart review UI (the action itself is created in Task 2's `cartStore`)

### Design Tokens (DO NOT hardcode hex values)

From `_bmad-output/planning-artifacts/ux-design-specification.md` — Visual Foundation:

| Token | Tailwind Class | Usage |
|---|---|---|
| `#FF6B35` accent | `bg-accent`, `text-accent`, `border-accent` | Add to Order CTA, selected variant highlight, CartBar background |
| `#F5F5F7` surface-raised | `bg-surface-raised` | Bottom sheet background (or `bg-surface`) |
| `#AEAEB2` text-secondary | `text-text-secondary` | Description, timestamps |
| `#000000` text-primary | `text-text-primary` | Item name, price |

CartBar: `bg-accent text-white` — orange background, white text.
"Add to Order" CTA: `bg-accent text-white`, `min-h-[48px]` (44px minimum touch target).
Selected variant option: `border-accent bg-accent/10`.

Typography in ItemConfigSheet:
- Item name: `text-[22px] font-semibold leading-7` (title-2 scale)
- Price: `font-mono text-base` (monospaced for price alignment)
- Description: `text-sm text-text-secondary`
- Variant label: `text-base` (callout scale)

### Testing Patterns

Follow existing test patterns from `tests/unit/customer/MenuItemRow.test.tsx`:
- Import: `from 'vitest'` for `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`
- Import: `from '@testing-library/react'` for `render`, `screen`, `fireEvent`, `cleanup`
- `afterEach(() => cleanup())`

For Zustand store tests — reset state between tests:
```typescript
import { useCartStore } from '@/stores/cartStore'

beforeEach(() => {
  useCartStore.setState({ items: [] })
})
```

For `<dialog>` in jsdom (Vitest uses jsdom): `showModal()` and `close()` are NOT implemented in jsdom. Mock them:
```typescript
// In ItemConfigSheet.test.tsx setup
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})
```

The `cancel` event and Escape key behavior won't be testable via this approach — test the `onClose` call by simulating backdrop click and button clicks instead.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.3] — AC1–5 verbatim
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Communications Patterns: Zustand Store Structure] — exact store pattern, `create<CartStore>`, action placement
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Component Boundaries] — Client Component islands for CartBar, ItemConfigSheet
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Project Structure] — `stores/cartStore.ts`, `types/app.ts` CartItem, `components/customer/ItemConfigSheet.tsx`, `components/customer/CartBar.tsx`
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Component Strategy: ItemConfigSheet] — `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes, anatomy, states
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Component Strategy: CartBar] — `role="complementary"`, `aria-label`, `aria-live="polite"`, anatomy, hidden when 0 items
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Visual Foundation] — design tokens, typography scale, safe area insets
- [Source: `_bmad-output/implementation-artifacts/4-2-menu-browsing-by-category-with-availability-filtering.md` — Dev Notes] — story 4-2 completed; `onTap` was left as `undefined` — story 4-3 wires it
- [Source: `components/customer/MenuItemRow.tsx`] — existing component; props: `item: MenuItem`, `isAvailable: boolean`, `onTap?: () => void` — interface unchanged
- [Source: `app/[restaurant_slug]/[table_number]/page.tsx`] — current SSR page; must extract interactive rendering into `CustomerMenuClient`; keep `SessionInitializer` here
- [Source: `types/app.ts`] — existing types; `VariantGroup`, `VariantOption` with `price_cents` field — variant price replaces base item price (not additive)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ItemConfigSheet jsdom issue: `showModal()` mock needed to call `this.setAttribute('open', '')` so dialog content is accessible to Testing Library. Without setting the `open` attribute, all roles inside the dialog are hidden. Fixed in `tests/unit/customer/ItemConfigSheet.test.tsx` `beforeEach`.

### Completion Notes List

- Task 0: Installed zustand@5.0.13 — added to package.json dependencies
- Task 1: Added `SelectedVariant`, `CartItem`, `EnrichedMenuItem` types to `types/app.ts`
- Task 2: Created `stores/cartStore.ts` — Zustand v5 store with `addItem`, `removeItem`, `clearCart`; no `'use client'` directive; state never mutated directly; 7 tests pass
- Task 3: Created `components/customer/ItemConfigSheet.tsx` — native `<dialog>` bottom sheet with focus trap (`showModal`), Escape via `cancel` event listener, backdrop click detection via `e.target === dialogRef.current`, auto-select first variant option, price computed from selected variant, `crypto.randomUUID()` for cartItemId, `requestAnimationFrame` for heading focus; 13 tests pass
- Task 4: Created `components/customer/CartBar.tsx` — hidden when 0 items, `role="complementary"`, `aria-live="polite"` on count pill, `env(safe-area-inset-bottom)` padding, story-4-4 navigation stubbed as no-op; 7 tests pass
- Task 5: Created `components/customer/CustomerMenuClient.tsx` — Client Component island managing selectedItem state, renders CategoryTabs + category sections + MenuItemRow (with onTap wired for available items) + ItemConfigSheet (controlled) + CartBar; unavailable items get `onTap={undefined}`
- Task 6: Refactored `page.tsx` — SSR data fetching unchanged; computes `enrichedItems` (MenuItem + isAvailable) server-side; passes serializable data to `CustomerMenuClient`; removed direct CategoryTabs/MenuItemRow/UNCATEGORIZED_KEY imports
- Task 7: 27 new unit tests added (7 cartStore + 13 ItemConfigSheet + 7 CartBar); all 228 tests pass with zero regressions

### File List

- package.json (modified — zustand@5.0.13 added)
- package-lock.json (modified)
- types/app.ts (modified — SelectedVariant, CartItem, EnrichedMenuItem added)
- stores/cartStore.ts (new)
- components/customer/ItemConfigSheet.tsx (new)
- components/customer/CartBar.tsx (new)
- components/customer/CustomerMenuClient.tsx (new)
- app/[restaurant_slug]/[table_number]/page.tsx (modified — uses CustomerMenuClient)
- tests/unit/customer/cartStore.test.ts (new)
- tests/unit/customer/ItemConfigSheet.test.tsx (new)
- tests/unit/customer/CartBar.test.tsx (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/4-3-item-detail-variant-configuration-add-to-cart.md (modified)

## Change Log

- 2026-05-18: Implemented story 4.3 — ItemConfigSheet (native dialog, focus trap, variant selectors, auto-select first option), CartBar (hidden when empty, aria-live), CustomerMenuClient (Client Component island, onTap wiring), page.tsx refactored to pass EnrichedMenuItem to client; zustand@5.0.13 installed; 27 new tests, 228/228 total pass
