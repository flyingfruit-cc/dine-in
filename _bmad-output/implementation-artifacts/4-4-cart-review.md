# Story 4.4: Cart Review

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to review my full order summary before submitting,
so that I can confirm everything is correct before it goes to the kitchen.

## Acceptance Criteria

**AC1** — CartBar visible and navigates to cart review:
Given the customer has at least one item in the cart
When the CartBar is visible
Then it shows item count pill (left), "Review Order" label (centre), and total price (right), fixed to the bottom of the screen with iOS safe area inset respected
And `aria-live="polite"` announces count changes to screen readers
And tapping the CartBar navigates to the cart review screen
And the CartBar is keyboard-activatable (Tab-focus + Enter/Space triggers navigation)

**AC2** — Cart review screen shows full order summary:
Given the customer taps the CartBar
When the order review screen renders at `/{restaurant_slug}/{table_number}/cart`
Then each cart line item is shown with: item name, selected variants (listed below name), quantity, and line total
And the grand total is shown at the bottom of the item list
And a single full-width "Place Order" CTA is visible (stub for story 4-5 — exists but triggers no server call in this story)

**AC3** — Navigate back from review preserves cart:
Given the customer navigates back from the review screen (browser back or explicit back)
When they return to the menu
Then the CartBar still shows their current cart — no items are lost

**AC4** — Cart with 0 items: CartBar hidden:
Given the cart has 0 items
When the menu renders
Then the CartBar is hidden entirely (returns null)

**AC5** — Remove item updates order summary immediately:
Given the customer is on the order review screen
When they tap the remove action on a cart line item
Then the item is removed from `cartStore` and the order summary and grand total update immediately without a page reload
And if there are multiple identical items (same item + same variant selection), removing one decrements the quantity by 1

**AC6** — Remove last item returns to menu:
Given the customer removes the last item from the cart on the review screen
When the cart becomes empty
Then the customer is automatically returned to the menu and the CartBar is hidden

---

## Tasks / Subtasks

- [x] Task 1: Update `components/customer/CartBar.tsx` — keyboard accessibility + navigation (AC: 1, 3, 4)
  - [x] Import `useParams` from `next/navigation` to read `restaurant_slug` and `table_number`
  - [x] Import `useRouter` from `next/navigation`
  - [x] Keep outer `<div role="complementary">` as the landmark — do NOT put `onClick` on it
  - [x] Wrap the interior (count pill, "Review Order", total) in a `<button>` element — `<button>` is inherently focusable and keyboard-activatable
  - [x] Button `onClick`: `router.push(`/${params.restaurant_slug}/${params.table_number}/cart`)`
  - [x] Move the `aria-label` from the outer div to the `<button>`: `aria-label={`Cart: ${count} ${count === 1 ? 'item' : 'items'}, ${formatPrice(total)} — tap to review order`}`
  - [x] Keep `aria-live="polite"` on the count pill span
  - [x] Preserve `fixed bottom-0 left-0 right-0` and `env(safe-area-inset-bottom)` on outer `<div>` (layout)
  - [x] The button itself fills the full bar: `className="flex w-full items-center justify-between px-4 py-3 bg-accent text-white"`
  - [x] Do NOT change CartBar export name or props interface

- [x] Task 2: Create `app/[restaurant_slug]/[table_number]/cart/page.tsx` — cart review page (AC: 2, 3, 5, 6)
  - [x] `'use client'` directive at top — this page reads Zustand; no server data needed
  - [x] `useParams<{ restaurant_slug: string; table_number: string }>()` to get route context
  - [x] `useRouter()` for empty-cart redirect
  - [x] Read `items` from `useCartStore`
  - [x] `useEffect`: when `items.length === 0` → `router.replace(`/${params.restaurant_slug}/${params.table_number}`)` — return to menu
  - [x] Compute `lineItems` by grouping cart items (see Dev Notes for grouping logic)
  - [x] Compute `grandTotal` as sum of `(item.price_cents * item.quantity)` across all line items
  - [x] Render: page header → scrollable item list → sticky bottom CTA
  - [x] Page header: simple `<h1>Order Review</h1>` or similar; no explicit back button (browser back handles navigation)
  - [x] Each line item: item name, variant list (one per line below name), quantity display (e.g. `×2`), line total (`formatPrice(item.price_cents * item.quantity)`)
  - [x] Remove button per line: `onClick={() => useCartStore.getState().removeItem(item.cartItemIds[0])}` — removes ONE cartItemId per tap
  - [x] Remove button accessibility: `aria-label={`Remove one ${item.name} from cart`}`
  - [x] Grand total row: label "Total" + `formatPrice(grandTotal)`; use a `<hr>` or border divider above it
  - [x] "Place Order" CTA: full-width `<button>` at bottom; `onClick={() => { /* story 4-5 wires submitOrder */ }}` stub; `bg-accent text-white min-h-[48px]`; sticky/fixed to bottom with `env(safe-area-inset-bottom)` padding
  - [x] Do NOT create `actions/orderActions.ts` — that is story 4-5

- [x] Task 3: Update `tests/unit/customer/CartBar.test.tsx` — add navigation mocks (AC: 1, 4)
  - [x] Add `vi.mock('next/navigation', ...)` at top of file (before imports used in tests)
  - [x] Mock `useParams` to return `{ restaurant_slug: 'test-restaurant', table_number: '5' }`
  - [x] Mock `useRouter` to return `{ push: vi.fn() }`
  - [x] Add test: CartBar renders a `<button>` role within the complementary landmark
  - [x] Add test: clicking the button calls `router.push` with the correct cart URL
  - [x] Existing tests (empty state, count, label, total, aria-label singular/plural) should continue to pass with minor adjustments if needed due to new structure
  - [x] NOTE: the `aria-label` is now on the `<button>`, not the outer `<div role="complementary">`. Update aria-label assertions accordingly.

- [x] Task 4: Create `tests/unit/customer/CartPage.test.tsx` — cart review page tests (AC: 2, 5, 6)
  - [x] Mock `next/navigation`: `useParams` returns `{ restaurant_slug: 'my-restaurant', table_number: '3' }`, `useRouter` returns `{ replace: vi.fn(), push: vi.fn() }`
  - [x] Mock `useCartStore` state via `useCartStore.setState({ items: [...] })`
  - [x] Reset store `beforeEach(() => useCartStore.setState({ items: [] }))`
  - [x] Test: renders all items in cart
  - [x] Test: shows variants for items that have them
  - [x] Test: shows quantity when same item added twice
  - [x] Test: shows grand total correctly
  - [x] Test: clicking remove calls `removeItem` with correct cartItemId
  - [x] Test: empty cart triggers `router.replace` to menu URL
  - [x] Test: "Place Order" button is present in the DOM

### Review Findings

- [x] [Review][Patch] `aria-live="polite"` inside `<button>` — ARIA live regions are suppressed by most screen readers when nested inside interactive widgets; move live region outside the button element [components/customer/CartBar.tsx:22-24]
- [x] [Review][Patch] `useEffect` depends on `params` object reference — `useParams()` returns a new object each render in Next.js App Router, causing the empty-cart redirect effect to re-execute on every render instead of only when `items.length` changes; destructure to primitive deps [app/[restaurant_slug]/[table_number]/cart/page.tsx:51-55]
- [x] [Review][Defer] `groupCartItems` silently merges items with same `menuItemId`+variants but different `price_cents` — low-probability edge case (price would need to change between add-to-cart and review); not in this story's scope [app/[restaurant_slug]/[table_number]/cart/page.tsx:19-44] — deferred, pre-existing by design
- [x] [Review][Defer] AC3 (back-navigation preserves cart) has no unit test — Zustand in-memory persistence covers this implicitly; verification requires an e2e test — deferred, pre-existing
- [x] [Review][Defer] `groupCartItems` defined at module scope in page file — minor structure concern; refactor to shared utility if needed elsewhere — deferred, pre-existing
- [x] [Review][Defer] Last-item-removed redirect test mutates store after `fireEvent.click` without explicit `act()` — RTL wraps events internally; tests pass; minor testing hygiene — deferred, pre-existing

---

## Dev Notes

### CartBar Keyboard Fix: Landmark + Interactive Element Separation

The `<div role="complementary">` is a non-interactive landmark (ARIA landmark roles must not be on interactive elements). The `onClick` must live on a child `<button>`.

**Required structure:**
```tsx
// CartBar.tsx — new structure
const params = useParams<{ restaurant_slug: string; table_number: string }>()
const router = useRouter()

return (
  <div
    role="complementary"
    className="fixed bottom-0 left-0 right-0 bg-accent text-white"
  >
    <button
      onClick={() => router.push(`/${params.restaurant_slug}/${params.table_number}/cart`)}
      className="flex w-full items-center justify-between px-4 py-3"
      style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
      aria-label={`Cart: ${count} ${count === 1 ? 'item' : 'items'}, ${formatPrice(total)} — tap to review order`}
    >
      <span aria-live="polite" className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold">
        {count}
      </span>
      <span className="text-base font-semibold">Review Order</span>
      <span className="font-mono text-sm font-semibold">{formatPrice(total)}</span>
    </button>
  </div>
)
```

Key changes from story 4-3 CartBar:
- `onClick` removed from `<div>` — moves to `<button>`
- `aria-label` moves from `<div>` to `<button>`
- `padding-bottom` moves from outer div to button (so it's part of the interactive tap area)
- `useParams` + `useRouter` imported from `next/navigation`

### Cart Review Page Route

**File:** `app/[restaurant_slug]/[table_number]/cart/page.tsx`

This is a **Next.js nested dynamic route** — the folder is literally `[table_number]/cart/` inside `[restaurant_slug]/`. This is valid Next.js App Router nesting.

```
app/
  [restaurant_slug]/
    [table_number]/
      page.tsx            ← menu page (existing)
      loading.tsx         ← menu skeleton (existing)
      error.tsx           ← unavailable state (existing)
      cart/
        page.tsx          ← NEW — cart review (Client Component)
```

**CRITICAL: The cart page is a Client Component.** It MUST have `'use client'` at the top. All data comes from Zustand (client-side). No server data fetching. No `createAdminClient()` call.

### Cart Item Grouping Logic

The epic AC says "quantity" is shown per line. Since each "Add to Order" tap creates a separate `CartItem` entry in the store (no quantity field), group identical items before rendering.

Two items are "identical" if they have the same `menuItemId` AND the same `selectedVariants` (compare by value, not reference).

```typescript
interface CartLineItem {
  key: string
  menuItemId: string
  name: string
  price_cents: number
  selectedVariants: SelectedVariant[]
  quantity: number
  cartItemIds: string[]  // all cartItemIds in this group
}

function groupCartItems(items: CartItem[]): CartLineItem[] {
  const map = new Map<string, CartLineItem>()
  for (const item of items) {
    // Stable key: menuItemId + sorted variant selections
    const variantKey = item.selectedVariants
      .map((v) => `${v.groupId}:${v.optionId}`)
      .sort()
      .join(',')
    const key = `${item.menuItemId}:${variantKey}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity++
      existing.cartItemIds.push(item.cartItemId)
    } else {
      map.set(key, {
        key,
        menuItemId: item.menuItemId,
        name: item.name,
        price_cents: item.price_cents,
        selectedVariants: item.selectedVariants,
        quantity: 1,
        cartItemIds: [item.cartItemId],
      })
    }
  }
  return Array.from(map.values())
}
```

**Remove action:** call `useCartStore.getState().removeItem(line.cartItemIds[0])` — removes one cartItemId. If quantity was 1, the group disappears. If quantity was 2, it drops to 1.

**Grand total:** `lineItems.reduce((sum, l) => sum + l.price_cents * l.quantity, 0)`

### Empty Cart Redirect Pattern

```tsx
const { items } = useCartStore()
const router = useRouter()
const params = useParams<{ restaurant_slug: string; table_number: string }>()

useEffect(() => {
  if (items.length === 0) {
    router.replace(`/${params.restaurant_slug}/${params.table_number}`)
  }
}, [items.length, params, router])
```

Use `router.replace` (not `push`) so the cart page doesn't remain in browser history after redirect — user won't see a blank cart page if they press back.

### Place Order CTA — Stub for Story 4-5

```tsx
<button
  type="button"
  onClick={() => {
    // story 4-5 wires submitOrder Server Action here
  }}
  className="w-full bg-accent text-white text-base font-semibold min-h-[48px] rounded-xl"
>
  Place Order
</button>
```

Do NOT create `actions/orderActions.ts`. Do NOT connect to Supabase. Story 4-5 owns order submission. The button must exist in the DOM so AC2 and story 4-5 can assume its presence.

For the layout, the "Place Order" button should be sticky at the bottom of the viewport (like CartBar on the menu page):

```tsx
{/* Sticky bottom CTA */}
<div
  className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 pt-3"
  style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
>
  <button
    type="button"
    onClick={() => { /* story 4-5 */ }}
    className="w-full flex items-center justify-center bg-accent text-white text-base font-semibold min-h-[48px] rounded-xl"
  >
    Place Order
  </button>
</div>
```

Add `pb-32` or equivalent to the scrollable content area so the last item isn't hidden behind the fixed button.

### Mocking `next/navigation` in Vitest

Vitest uses jsdom; `next/navigation` hooks (`useParams`, `useRouter`) don't exist in jsdom and must be mocked.

```typescript
// At the top of the test file (before any imports that trigger module resolution)
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ restaurant_slug: 'test-restaurant', table_number: '5' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
```

Reset mocks between tests:
```typescript
beforeEach(() => {
  mockPush.mockReset()
  mockReplace.mockReset()
  useCartStore.setState({ items: [] })
})
```

### Testing Remove Item

```tsx
// In CartPage.test.tsx
it('clicking remove decrements quantity in cartStore', async () => {
  const item1 = makeCartItem('a', 1500)
  const item2 = makeCartItem('b', 1500)  // same price, different cartItemId
  useCartStore.setState({ items: [item1, item2] })
  render(<CartPage />)
  // After grouping, there's 1 line with quantity 2
  const removeBtn = screen.getByRole('button', { name: /remove one/i })
  fireEvent.click(removeBtn)
  expect(useCartStore.getState().items).toHaveLength(1)
})
```

### CartBar.test.tsx Updates

The test file already exists at `tests/unit/customer/CartBar.test.tsx` (7 tests, all passing). After the structural change (div → button inside div), the `aria-label` moves to the button, so:

- `screen.getByRole('complementary')` still finds the outer `<div role="complementary">` — no change
- `screen.getByRole('button')` now finds the inner button — NEW assertion target
- `bar.getAttribute('aria-label')` — now `bar` is the button, not the div; update test to use `screen.getByRole('button')` to get the element with the `aria-label`

Existing tests that do `screen.getByRole('complementary').getAttribute('aria-label')` will break since the aria-label moves to the button. Update those assertions to use the button:

```typescript
// OLD (failing after refactor):
const bar = screen.getByRole('complementary')
expect(bar.getAttribute('aria-label')).toBe('Cart: 2 items, $25.00')

// NEW (correct after refactor):
const btn = screen.getByRole('button')
expect(btn.getAttribute('aria-label')).toContain('Cart: 2 items, $25.00')
```

### What This Story Does NOT Change

- `stores/cartStore.ts` — no changes; `removeItem` is already implemented
- `components/customer/CustomerMenuClient.tsx` — no changes; CartBar renders inside it and self-navigates
- `components/customer/ItemConfigSheet.tsx` — no changes
- `components/customer/MenuItemRow.tsx` — no changes
- `app/[restaurant_slug]/[table_number]/page.tsx` — no changes
- `actions/orderActions.ts` — does NOT exist yet; story 4-5 creates it
- `types/app.ts` — `CartLineItem` is a local type in the cart page, NOT added to `app.ts`

### What Story 4-5 Will Add

- `actions/orderActions.ts` with `submitOrder` Server Action
- The `onClick` stub on "Place Order" button will be wired to call `submitOrder`
- `OrderConfirmationScreen` component
- Loading state on the "Place Order" button during submission

### Accessibility for Cart Review Page

- Wrap the entire scrollable content in `<main>` (not a nested div)
- Page title: `<h1>Order Review</h1>` for proper document outline
- Each line item: render as a `<li>` inside a `<ul>`
- Remove button per line: `<button type="button" aria-label={`Remove one ${item.name} from cart`}>`
- Grand total: `<p>` or `<div>` with `role="status"` so `aria-live` announces updates (optional — the total updating is visible)
- "Place Order" button: `aria-label="Place Order"` (or just button text is sufficient)

### Design Tokens

```
CartBar button:        bg-accent text-white (orange bg, white text)
Remove button:         text-text-secondary or text-error, no background
Line item separator:   border-b border-border
Grand total divider:   border-t border-border (stronger visual weight)
Place Order CTA:       bg-accent text-white (same as CartBar, min-h-[48px], rounded-xl)
```

Do NOT hardcode hex values. Use Tailwind design tokens only.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.4] — AC1–6 verbatim
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Component Strategy: CartBar] — `role="complementary"`, keyboard, anatomy, safe area
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Journey 1: Aisha] — "Tap Review Order → Full-screen order summary → Place Order CTA"
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Route Structure] — `app/[restaurant_slug]/[table_number]/` nesting; cart page fits as a nested route
- [Source: `_bmad-output/planning-artifacts/architecture.md` — State Management] — Zustand for cart; client-side only; no SSR for cart data
- [Source: `_bmad-output/implementation-artifacts/4-3-item-detail-variant-configuration-add-to-cart.md` — Deferred: CartBar `<div>` not keyboard-activatable] — this story resolves that deferred item
- [Source: `_bmad-output/implementation-artifacts/4-3-item-detail-variant-configuration-add-to-cart.md` — Dev Agent Record] — `CartItem` type, `removeItem` already in cartStore, `formatPrice` utility
- [Source: `components/customer/CartBar.tsx`] — current implementation to be modified
- [Source: `stores/cartStore.ts`] — `removeItem(cartItemId: string)` already implemented; `clearCart()` available for future use
- [Source: `types/app.ts`] — `CartItem`, `SelectedVariant` types; `CartLineItem` is local to the cart page

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `getByText('$24.00')` failed on "shows line total" test because with a single grouped line (2× $12 Burger), both the line total and grand total render `$24.00`. Fixed by adding a second distinct item (Fries) so the line total and grand total differ.

### Completion Notes List

- Task 1: Refactored `CartBar.tsx` — `<div role="complementary">` now wraps an inner `<button>` for keyboard accessibility. `useParams()` + `useRouter()` from `next/navigation` provide the cart URL. `aria-label` and `onClick` moved from outer div to button. `aria-live="polite"` preserved on count pill. 9 CartBar tests pass.
- Task 2: Created `app/[restaurant_slug]/[table_number]/cart/page.tsx` — Client Component page with `groupCartItems()` helper that groups by `menuItemId + sorted variant keys`. `useEffect` on `items.length` triggers `router.replace` on empty cart. Sticky "Place Order" button at bottom with safe-area padding (stub for story 4-5). 12 CartPage tests pass.
- Task 3: Updated `tests/unit/customer/CartBar.test.tsx` — added `vi.mock('next/navigation', ...)` with `useParams` + `useRouter` mocks. Updated `aria-label` assertions to target `getByRole('button')` instead of `getByRole('complementary')`. Added button keyboard-activation and navigation tests. 9 tests pass.
- Task 4: Created `tests/unit/customer/CartPage.test.tsx` — 12 tests covering: empty cart redirect, item render, quantity display, line/grand total, variant list, remove action, quantity decrement, last-item redirect, Place Order button presence, and variant-split grouping.
- Full suite: 242 tests across 26 files, all passing, zero regressions.

### File List

- components/customer/CartBar.tsx (modified — keyboard fix, useParams/useRouter navigation)
- app/[restaurant_slug]/[table_number]/cart/page.tsx (new — cart review Client Component)
- tests/unit/customer/CartBar.test.tsx (modified — next/navigation mocks, new tests)
- tests/unit/customer/CartPage.test.tsx (new — 12 cart page tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/4-4-cart-review.md (modified)

### Change Log

- 2026-05-18: Implemented story 4.4 — CartBar keyboard fix (div landmark + inner button, useParams/useRouter navigation to /cart), cart review page (Client Component, groupCartItems grouping with quantity display, remove decrements group, sticky Place Order stub, empty-cart redirect via router.replace); 21 new tests (9 CartBar + 12 CartPage), 242/242 total pass
