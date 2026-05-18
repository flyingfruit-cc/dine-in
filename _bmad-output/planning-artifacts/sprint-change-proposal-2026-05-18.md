# Sprint Change Proposal — Cart Review: Add More Items Navigation

**Date:** 2026-05-18
**Scope:** Minor (implemented directly)
**Status:** Implemented

---

## 1. Issue Summary

The cart review screen (`/{restaurant_slug}/{table_number}/cart`) had no visible affordance for customers to return to the menu and add or adjust items. The only exit paths were: (a) Place Order, (b) remove items until the cart empties triggering an auto-redirect, or (c) the browser's back button — invisible and unreliable on mobile.

The original spec intentionally designed a linear flow with no secondary actions, but this created a dead-end UX. In a dine-in context, customers frequently want to browse more, add another dish, or reconsider their selection before ordering.

**Discovered:** Post-implementation review of story 4-4 (cart review).

---

## 2. Impact Analysis

| Area | Impact |
|---|---|
| `epics.md` — Story 4.4 AC | AC updated to allow secondary "Add more items" action |
| `ux-design-specification.md` — Navigation Patterns | Updated to reflect explicit back navigation in cart review |
| `app/[restaurant_slug]/[table_number]/cart/page.tsx` | Header updated with "Add more items" button |
| `tests/unit/customer/CartPage.test.tsx` | 2 new tests added (button presence + router.back() call) |
| Architecture | No impact |
| Story 4.5 | No impact |

---

## 3. Changes Applied

### epics.md — Story 4.4 AC2

**OLD:**
> And a single full-width "Place Order" CTA is the only action — no secondary actions

**NEW:**
> And a full-width "Place Order" CTA is shown as the primary action
> And an "Add more items" link in the page header allows the customer to return to the menu with cart preserved

### ux-design-specification.md — Navigation Patterns

**OLD:**
> Customer flow: Linear, no back navigation needed. QR → Menu → Item config (sheet) → Cart review → Confirmation. No persistent nav bar — the CartBar is the only persistent element.

**NEW:**
> Customer flow: QR → Menu → Item config (sheet) → Cart review → Confirmation. No persistent nav bar — the CartBar is the only persistent element. The cart review screen exposes an explicit "Add more items" action in the page header so customers can return to the menu; cart state is preserved across this navigation.

### cart/page.tsx — Header

Added `← Add more items` button (left-aligned) alongside the "Order Review" heading. Calls `router.back()`. Cart state preserved by Zustand in-memory persistence.

### CartPage.test.tsx — New tests

- `shows "Add more items" button in header`
- `"Add more items" calls router.back()`

**Test result:** 244/244 passing, zero regressions.

---

## 4. Handoff

**Scope:** Minor — implemented directly in this session.
**No further handoff required.**
