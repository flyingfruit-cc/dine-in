# Story 4.5: Order Submission & Confirmation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to submit my order with a single tap and receive immediate confirmation,
so that I know my order has reached the kitchen without needing to speak to staff.

## Acceptance Criteria

**AC1** — Place Order triggers pessimistic submission:
Given the customer taps "Place Order"
When `submitOrder()` Server Action is called
Then the UI waits for the Supabase INSERT acknowledgement before transitioning (pessimistic, NFR12)
And the "Place Order" button shows a loading state during the wait (disabled, spinner or "Placing order…" text)

**AC2** — Successful order shows full-screen confirmation:
Given the INSERT succeeds
When the server acknowledges
Then the `OrderConfirmationScreen` renders full-screen: green check icon, headline "Your order is with the kitchen", order summary (items + quantities, no prices), restaurant name + table number tag
And `aria-live="assertive"` on the headline announces confirmation to screen readers
And focus moves to the headline element on mount

**AC3** — Confirmation is a closed loop:
Given the confirmation screen is shown
When the customer views it
Then no rating prompts, account nudges, or next-step actions are shown — it is terminal

**AC4** — Failed submission shows inline error with retry:
Given the INSERT fails
When the error is returned
Then the customer stays on the review screen with inline error: "Tap to try again — your order hasn't been sent"
And the full cart is preserved — no items are lost
And the "Place Order" button is re-enabled

**AC5** — Order record is correctly persisted:
Given an order is persisted
When the record is written
Then it contains `restaurant_id`, `table_id` (UUID), `items` (jsonb with names, variants array, quantities — NO prices), `submitted_at` (auto-default), `is_handled: false`
And no customer PII is stored anywhere in the record (NFR9)
And the `items` jsonb groups identical items (same menuItemId + variants) into a single entry with quantity count

---

## Tasks / Subtasks

- [x] Task 1: Create `actions/orderActions.ts` — `submitOrder` Server Action (AC: 1, 4, 5)
  - [x] `'use server'` directive at top
  - [x] Import `createClient` from `@/lib/supabase/server` (anonymous customer session)
  - [x] Import `createAdminClient` from `@/lib/supabase/admin` (lookup only — NOT for INSERT)
  - [x] Import `ActionResult`, `CartItem` from `@/types/app`
  - [x] Define `SubmitOrderData` interface: `{ orderId: string; restaurantName: string; tableNumber: number }`
  - [x] Export `async function submitOrder(cartItems: CartItem[]): Promise<ActionResult<SubmitOrderData>>`
  - [x] Get user from `createClient()` → validate `user.is_anonymous === true`
  - [x] Extract `restaurant_id` and `table_number` from `user.app_metadata`
  - [x] Use `createAdminClient()` to resolve `table_id` (by `restaurant_id` + `number`) and `restaurantName` (by `restaurant_id`) — run as `Promise.all` for parallelism
  - [x] Build `items` jsonb by grouping `cartItems` (same key logic as `groupCartItems` in cart page): `{ name, quantity, variants: string[] }[]` — NO price_cents at any point
  - [x] Insert using `createClient()` (anonymous session, NOT admin): `supabase.from('orders').insert({ restaurant_id, table_id, items, is_handled: false }).select('id').single()`
  - [x] Return `{ success: false, error: string }` for each failure path
  - [x] Return `{ success: true, data: { orderId, restaurantName, tableNumber } }` on success

- [x] Task 2: Create `components/customer/OrderConfirmationScreen.tsx` — full-screen closed-loop confirmation (AC: 2, 3)
  - [x] `'use client'` directive at top (needs `useEffect`, `useRef` for focus management)
  - [x] Define props: `restaurantName: string`, `tableNumber: string | number`, `items: ConfirmedItem[]` where `ConfirmedItem = { name: string; quantity: number; variantNames: string[] }`
  - [x] Render as `<main>` with `role="main"` — NOTE: this replaces the cart page `<main>`, not nested inside it (see Dev Notes)
  - [x] Implement focus management: `useRef<HTMLHeadingElement>` on headline, `useEffect(() => { headlineRef.current?.focus() }, [])` on mount
  - [x] Headline: `<h1 ref={headlineRef} tabIndex={-1} aria-live="assertive">Your order is with the kitchen</h1>`
  - [x] Green check icon: SVG circle with checkmark (no icon library — see Dev Notes for SVG snippet)
  - [x] Subtext: "Thank you! Your order has been received." (or similar warm, brief copy)
  - [x] Divider: `<hr>` or border
  - [x] Order summary: `<ul>` of items — each line shows `{quantity}× {name}` and variant names below; NO prices anywhere
  - [x] Restaurant + table tag at bottom: e.g. `{restaurantName} · Table {tableNumber}`
  - [x] No buttons, no navigation links, no next-step actions

- [x] Task 3: Modify `app/[restaurant_slug]/[table_number]/cart/page.tsx` — wire Place Order (AC: 1, 2, 3, 4)
  - [x] Add `useState` imports from `react`
  - [x] Import `submitOrder` from `@/actions/orderActions`
  - [x] Import `OrderConfirmationScreen` from `@/components/customer/OrderConfirmationScreen`
  - [x] Add state: `const [isSubmitting, setIsSubmitting] = useState(false)`
  - [x] Add state: `const [submitError, setSubmitError] = useState<string | null>(null)`
  - [x] Add state: `const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderState | null>(null)` (see Dev Notes for type)
  - [x] Update `useEffect` empty-cart redirect: add `confirmedOrder` to the condition — only redirect when `items.length === 0 && !confirmedOrder` (prevents redirect when cart clears after successful order)
  - [x] Update `useEffect` dependency array: add `confirmedOrder`
  - [x] Implement `handlePlaceOrder` async function:
    - Capture `currentLineItems = lineItems` (already computed) and `currentRawItems = items` before any state changes
    - `setIsSubmitting(true)`, `setSubmitError(null)`
    - `const result = await submitOrder(currentRawItems)`
    - On success: `setConfirmedOrder({ ...result.data, lineItems: currentLineItems })`, then `useCartStore.getState().clearCart()`
    - On failure: `setSubmitError(result.error)`, `setIsSubmitting(false)`
  - [x] When `confirmedOrder` is set: return `<OrderConfirmationScreen restaurantName={confirmedOrder.restaurantName} tableNumber={confirmedOrder.tableNumber} items={confirmedOrder.lineItems.map(l => ({ name: l.name, quantity: l.quantity, variantNames: l.selectedVariants.map(v => v.optionName) }))} />`
  - [x] Update the Place Order `<button>`:
    - `onClick={handlePlaceOrder}`
    - `disabled={isSubmitting}`
    - Show "Placing order…" when `isSubmitting`, "Place Order" otherwise
    - `aria-label` updates accordingly
  - [x] Add inline error display above the Place Order button: when `submitError`, render `<p role="alert">{submitError}</p>` (use `text-error` token, NOT hardcoded color)
  - [x] Remove the `// story 4-5 wires submitOrder Server Action here` comment

- [x] Task 4: Create `tests/unit/customer/OrderConfirmationScreen.test.tsx` (AC: 2, 3)
  - [x] Test: renders headline "Your order is with the kitchen"
  - [x] Test: renders each item name with quantity prefix (e.g. "2× Burger")
  - [x] Test: renders variant names below item name
  - [x] Test: renders restaurant name and table number
  - [x] Test: does NOT render any price (assert no `$` in the document)
  - [x] Test: no interactive buttons or links rendered (AC3 — closed loop)
  - [x] Test: headline has `aria-live="assertive"` attribute
  - [x] Test: headline has `tabIndex={-1}` (focusable programmatically)

- [x] Task 5: Update `tests/unit/customer/CartPage.test.tsx` — submission flow (AC: 1, 2, 4)
  - [x] Add `vi.mock('@/actions/orderActions', ...)` at top — mock `submitOrder`
  - [x] Test: Place Order button is disabled and shows loading text during submission
  - [x] Test: `OrderConfirmationScreen` renders after successful submitOrder
  - [x] Test: submitError message renders on failed submitOrder (contains "Tap to try again")
  - [x] Test: button re-enabled after failed submitOrder
  - [x] Test: cart is cleared (via `useCartStore.getState().items`) after successful submitOrder
  - [x] Ensure existing 14 CartPage tests still pass

### Review Findings

- [x] [Review][Patch] Empty cart not guarded in Server Action — `submitOrder([])` inserts an empty `items: []` row; add `if (cartItems.length === 0) return { success: false, error: "..." }` at top of action [actions/orderActions.ts]
- [x] [Review][Defer] `isSubmitting` not reset to `false` on success [app/[restaurant_slug]/[table_number]/cart/page.tsx] — deferred; confirmation screen replaces the cart UI entirely so no stuck button is visible; state resets on navigation
- [x] [Review][Defer] Double-submit race before React re-render commits `disabled` [app/[restaurant_slug]/[table_number]/cart/page.tsx] — deferred; React 18 automatic batching makes this window effectively zero in practice
- [x] [Review][Defer] `app_metadata` fields not existence-checked before destructure [actions/orderActions.ts] — deferred; missing fields cause query to return no rows, falling through safely to the generic error return
- [x] [Review][Defer] `aria-live="assertive"` on static heading is technically non-functional [components/customer/OrderConfirmationScreen.tsx] — deferred; `useEffect` focus management achieves the same screen-reader announcement outcome

---

## Dev Notes

### Critical: Which Supabase Client to Use for What

**RULE: INSERT via `createClient()` (customer session) — NOT admin client.**

The `customer_insert_order` RLS policy validates the anonymous JWT claims server-side:
```sql
CREATE POLICY "customer_insert_order" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'is_anonymous')::boolean = true
    AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND (SELECT t.number FROM public.tables t WHERE t.id = table_id ...) = (auth.jwt() -> 'app_metadata' ->> 'table_number')::integer
  );
```

If you use `createAdminClient()` for the INSERT it will bypass RLS and forgo this validation. Use `createClient()` for the INSERT so RLS runs. Use `createAdminClient()` ONLY for the pre-flight lookups (table_id and restaurantName) since customers don't have a read policy on restaurants.

```typescript
// Correct pattern in submitOrder:
const supabase = await createClient()           // customer's anon session — for INSERT
const adminClient = createAdminClient()          // service role — for metadata lookups ONLY

// Lookups (no order data, no sensitive write):
const [{ data: table }, { data: restaurant }] = await Promise.all([
  adminClient.from('tables').select('id').eq('restaurant_id', restaurantId).eq('number', tableNumber).single(),
  adminClient.from('restaurants').select('name').eq('id', restaurantId).single(),
])

// INSERT — uses customer session, RLS validates JWT claims:
const { data: order, error } = await supabase
  .from('orders')
  .insert({ restaurant_id: restaurantId, table_id: table.id, items, is_handled: false })
  .select('id')
  .single()
```

### JWT Claims Structure

Anonymous session stores in `app_metadata` (set by `initAnonymousSession` in `customerActions.ts`):
```typescript
user.app_metadata: {
  restaurant_id: string  // UUID
  table_number: number   // integer
}
user.is_anonymous: true
```

Extract in Server Action:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user || user.is_anonymous !== true) return { success: false, error: '...' }
const { restaurant_id, table_number } = user.app_metadata as { restaurant_id: string; table_number: number }
```

Note: `table_id` (UUID) is NOT in the JWT — only `table_number` (integer). Resolve `table_id` via admin client lookup.

### Orders Table Schema

```sql
CREATE TABLE public.orders (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      uuid        NOT NULL REFERENCES public.tables(id) ON DELETE RESTRICT,
  items         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  submitted_at  timestamptz DEFAULT now() NOT NULL,
  is_handled    boolean     DEFAULT false NOT NULL,
  handled_at    timestamptz
);
```

**`submitted_at` is auto-defaulted** — do NOT pass it in the insert. `is_handled: false` must be explicit.

### Items JSONB Format — No Prices (NFR9)

The `items` jsonb groups cart items before persisting. Shape:
```typescript
[
  { name: "Burger", quantity: 2, variants: ["Large"] },
  { name: "Fries", quantity: 1, variants: [] }
]
```

- `variants` is `string[]` of `optionName` — NOT objects, NOT prices
- Group by `menuItemId + sorted(groupId:optionId)` (same logic as `groupCartItems` in cart/page.tsx)
- Never include `price_cents` — not in the DB record at all (NFR9)

The grouping logic in the Server Action mirrors `groupCartItems` but produces a different output type:
```typescript
const map = new Map<string, { name: string; quantity: number; variants: string[] }>()
for (const item of cartItems) {
  const variantKey = item.selectedVariants.map(v => `${v.groupId}:${v.optionId}`).sort().join(',')
  const key = `${item.menuItemId}:${variantKey}`
  const existing = map.get(key)
  if (existing) {
    existing.quantity++
  } else {
    map.set(key, {
      name: item.name,
      quantity: 1,
      variants: item.selectedVariants.map(v => v.optionName),
    })
  }
}
const items = Array.from(map.values())
```

### Cart Page State Management and Redirect Guard

The existing `useEffect` redirects to menu when `items.length === 0`. After a successful order, the cart is cleared BUT we want to show the confirmation screen. Guard the redirect:

```tsx
useEffect(() => {
  if (items.length === 0 && !confirmedOrder) {
    router.replace(`/${restaurant_slug}/${table_number}`)
  }
}, [items.length, restaurant_slug, table_number, router, confirmedOrder])
```

**State update order matters:** Set `confirmedOrder` BEFORE calling `clearCart()` to ensure the guard is in place before Zustand triggers a re-render:

```typescript
const handlePlaceOrder = async () => {
  const currentLineItems = lineItems   // capture current grouped items
  const currentItems = items            // capture raw items for the Server Action
  setIsSubmitting(true)
  setSubmitError(null)
  const result = await submitOrder(currentItems)
  if (result.success) {
    setConfirmedOrder({ ...result.data, lineItems: currentLineItems })  // guard first
    useCartStore.getState().clearCart()                                  // then clear
  } else {
    setSubmitError(result.error)
    setIsSubmitting(false)
  }
}
```

### ConfirmedOrderState Type (local to cart/page.tsx)

```typescript
interface ConfirmedOrderState {
  orderId: string
  restaurantName: string
  tableNumber: number
  lineItems: CartLineItem[]  // CartLineItem is already defined locally in the file
}
```

Do NOT add `ConfirmedOrderState` or `ConfirmedItem` to `types/app.ts` — keep them local.

### OrderConfirmationScreen Component Structure

```tsx
'use client'
import { useEffect, useRef } from 'react'

interface ConfirmedItem {
  name: string
  quantity: number
  variantNames: string[]
}

interface OrderConfirmationScreenProps {
  restaurantName: string
  tableNumber: string | number
  items: ConfirmedItem[]
}

export function OrderConfirmationScreen({ restaurantName, tableNumber, items }: OrderConfirmationScreenProps) {
  const headlineRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headlineRef.current?.focus()
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-surface px-6 pt-16 pb-12">
      {/* Green check circle icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-success"
          aria-hidden="true"
        >
          <circle cx={12} cy={12} r={10} />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>

      {/* Headline — receives focus and announces via assertive live region */}
      <h1
        ref={headlineRef}
        tabIndex={-1}
        aria-live="assertive"
        className="mb-2 text-center text-2xl font-semibold text-text-primary focus:outline-none"
      >
        Your order is with the kitchen
      </h1>

      <p className="mb-8 text-center text-base text-text-secondary">
        Thank you! Sit tight while we prepare your food.
      </p>

      <hr className="w-full border-border mb-6" />

      {/* Order summary — no prices */}
      <ul className="w-full space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex flex-col">
            <span className="text-base font-medium text-text-primary">
              {item.quantity}× {item.name}
            </span>
            {item.variantNames.map((v, vi) => (
              <span key={vi} className="text-sm text-text-secondary">{v}</span>
            ))}
          </li>
        ))}
      </ul>

      {/* Restaurant + table tag */}
      <p className="mt-8 text-sm text-text-secondary">
        {restaurantName} · Table {tableNumber}
      </p>
    </main>
  )
}
```

**Design tokens used:**
- `bg-success/10` — light green background for icon circle
- `text-success` — green checkmark color (Tailwind `#30D158` or similar; defined in `tailwind.config.ts`)
- `text-text-primary`, `text-text-secondary`, `bg-surface`, `border-border` — project standard tokens
- Do NOT hardcode hex values

**Check if `success` color is in `tailwind.config.ts`** before using `text-success` / `bg-success`. If not, check what green tokens exist. The UX spec references `#30D158` (dark mode success green). Add to tailwind config if missing rather than hardcoding.

### Cart Page: Conditional Render for Confirmation

When `confirmedOrder !== null`, the cart page renders ONLY `OrderConfirmationScreen`:

```tsx
if (confirmedOrder) {
  return (
    <OrderConfirmationScreen
      restaurantName={confirmedOrder.restaurantName}
      tableNumber={confirmedOrder.tableNumber}
      items={confirmedOrder.lineItems.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        variantNames: l.selectedVariants.map((v) => v.optionName),
      }))}
    />
  )
}
```

This check should come AFTER the `items.length === 0 && !confirmedOrder` null guard but BEFORE the main JSX return.

### Place Order Button States

```tsx
<button
  type="button"
  onClick={handlePlaceOrder}
  disabled={isSubmitting}
  aria-label={isSubmitting ? 'Placing order, please wait' : 'Place Order'}
  className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-60"
>
  {isSubmitting ? 'Placing order…' : 'Place Order'}
</button>
```

### Inline Error Display

Place above the bottom CTA div (inside the scrollable area, at the bottom of the item list section, OR just inside the fixed-bottom container above the button):

```tsx
{submitError && (
  <p role="alert" className="px-4 pb-2 text-sm text-error text-center">
    {submitError}
  </p>
)}
```

Use `role="alert"` so screen readers announce the error immediately.

The actual error text displayed should be user-friendly. The `submitError` comes from the Server Action's `error` field. In `submitOrder`, use actionable copy: "Tap to try again — your order hasn't been sent" as the fallback error message when no specific error is available. The spec AC4 specifies this exact copy — use it as the displayed text regardless of the underlying `error.message`.

Better pattern in the Server Action:
```typescript
if (error || !order) {
  return { success: false, error: "Tap to try again — your order hasn't been sent" }
}
```

### Server Action Return Type — ActionResult Pattern

```typescript
// types/app.ts — already defined
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// Correct usage — NEVER throw, always return ActionResult:
export async function submitOrder(cartItems: CartItem[]): Promise<ActionResult<SubmitOrderData>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous !== true) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }
  // ...
}
```

### Testing: Mocking submitOrder in CartPage Tests

```typescript
// In CartPage.test.tsx, add at top:
const mockSubmitOrder = vi.fn()
vi.mock('@/actions/orderActions', () => ({
  submitOrder: (...args: unknown[]) => mockSubmitOrder(...args),
}))

// In beforeEach: reset
mockSubmitOrder.mockReset()

// In test:
mockSubmitOrder.mockResolvedValue({
  success: true,
  data: { orderId: 'order-1', restaurantName: 'Test Restaurant', tableNumber: 3 },
})
```

Note: `vi.mock` is hoisted above imports — the factory function must reference `mockSubmitOrder` via the module variable, not closure. Use the pattern above (forwarding function) to avoid the hoisting footgun.

### Testing: OrderConfirmationScreen

```typescript
// tests/unit/customer/OrderConfirmationScreen.test.tsx
import { render, screen } from '@testing-library/react'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'

const items = [
  { name: 'Burger', quantity: 2, variantNames: ['Large'] },
  { name: 'Fries', quantity: 1, variantNames: [] },
]

it('renders headline', () => {
  render(<OrderConfirmationScreen restaurantName="Test" tableNumber={3} items={items} />)
  expect(screen.getByText('Your order is with the kitchen')).toBeDefined()
})

it('shows no prices', () => {
  render(<OrderConfirmationScreen restaurantName="Test" tableNumber={3} items={items} />)
  expect(screen.queryByText(/\$/)).toBeNull()
})
```

### What This Story Does NOT Do

- Does NOT create `app/[restaurant_slug]/[table_number]/order-confirmation/page.tsx` — confirmation is an inline state on the cart page, not a new route
- Does NOT add a "Go back" or "Order more" button to the confirmation screen — it is a closed loop (AC3)
- Does NOT store prices in the orders table — items jsonb has NO price_cents
- Does NOT use `createAdminClient()` for the INSERT — customer's authenticated session + RLS does the work
- Does NOT use `router.push` for confirmation — stays on the same URL (`/cart`)
- Does NOT add Order types to `types/app.ts` — `SubmitOrderData` and `ConfirmedOrderState` stay local to their files
- Does NOT clear the cart on Server Action failure — cart is ALWAYS preserved when submission fails

### What Story 5.1 Will Add (Do Not Implement Here)

- Supabase Realtime subscription in the Admin UI layout for incoming orders
- `useOrderStore` in `stores/orderStore.ts`
- `markOrderHandled` in `actions/orderActions.ts`
- Admin orders UI (`app/admin/orders/`)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.5] — AC1–5 verbatim, NFR9, NFR12
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 4.5] — "no customer PII stored", "items jsonb with names, variants, quantities"
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Server Action Return Format] — `ActionResult<T>` discriminated union
- [Source: `_bmad-output/planning-artifacts/architecture.md` — API Boundaries] — anonymous customer uses `createClient()`, admin uses `createAdminClient()`
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Directory Structure] — `actions/orderActions.ts`, `components/customer/OrderConfirmationScreen.tsx`
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Database Naming] — `is_handled`, `submitted_at`, `table_id` column conventions
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — OrderConfirmationScreen component] — `role="main"`, `aria-live="assertive"`, focus on headline, anatomy (no prices, kitchen copy)
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Journey 1 error path] — "Tap to retry — order not lost" inline copy
- [Source: `supabase/migrations/20260509144558_initial_schema.sql:47`] — full `orders` table schema
- [Source: `supabase/migrations/20260509152222_fix_anon_policies_to_authenticated.sql`] — `customer_insert_order` RLS policy (`TO authenticated`, `is_anonymous = true`)
- [Source: `actions/customerActions.ts`] — `initAnonymousSession` — sets `app_metadata: { restaurant_id, table_number }` in anonymous JWT
- [Source: `actions/menuActions.ts`] — Server Action pattern: `'use server'`, `createClient()`, `getAuthContext()`, `ActionResult` returns
- [Source: `stores/cartStore.ts`] — `clearCart()` implemented, call via `useCartStore.getState().clearCart()` in event handler
- [Source: `app/[restaurant_slug]/[table_number]/cart/page.tsx`] — current cart page state; Place Order stub at line 122; `groupCartItems` and `CartLineItem` local types; `confirmedOrder` guard needed in `useEffect`
- [Source: `_bmad-output/implementation-artifacts/4-4-cart-review.md` — Dev Notes] — `groupCartItems` logic, testing patterns, `useCartStore.getState()` in handlers, `vi.mock('next/navigation', ...)` hoisting pattern

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blockers encountered.

### Completion Notes List

- Task 1: `submitOrder` Server Action implemented. Uses `createClient()` for INSERT (RLS validates anonymous JWT) and `createAdminClient()` for parallel pre-flight lookups (`table_id` + `restaurantName`). Items jsonb groups cart items by `menuItemId:variantKey`, emitting `{ name, quantity, variants: string[] }` — no prices per NFR9. All failure paths return the user-facing error copy: "Tap to try again — your order hasn't been sent".
- Task 2: `OrderConfirmationScreen` is a pure presentational component. Inline SVG checkmark (no icon library). `aria-live="assertive"` on headline + `useRef` focus on mount satisfy AC2 accessibility requirements. No buttons, no links — closed loop per AC3.
- Task 3: Cart page wired with three state pieces: `isSubmitting`, `submitError`, `confirmedOrder`. Guard on `useEffect` redirect updated to `items.length === 0 && !confirmedOrder`. `setConfirmedOrder` called BEFORE `clearCart()` to prevent premature redirect race. Confirmation renders by returning `<OrderConfirmationScreen>` when `confirmedOrder !== null`.
- Task 4: 8 unit tests for OrderConfirmationScreen — all pass.
- Task 5: 5 new CartPage submission tests + all 14 existing CartPage tests preserved = 19 CartPage tests total. Full suite: 257/257.

### File List

actions/orderActions.ts (new)
components/customer/OrderConfirmationScreen.tsx (new)
app/[restaurant_slug]/[table_number]/cart/page.tsx (modified)
tests/unit/customer/OrderConfirmationScreen.test.tsx (new)
tests/unit/customer/CartPage.test.tsx (modified)

### Change Log

- 2026-05-18: Implemented story 4-5 — order submission Server Action, OrderConfirmationScreen component, cart page wiring, and full test suite (13 new tests, 257 total passing)
