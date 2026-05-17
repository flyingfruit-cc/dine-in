# Story 4.1: QR Scan, Anonymous Session & Menu Load

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want to scan the QR code on my table and immediately see the restaurant's live menu in my mobile browser,
So that I can begin browsing without downloading an app or creating an account.

## Acceptance Criteria

**AC1** — Anonymous session issued server-side on QR scan:
Given a customer scans the QR code at their table
When the browser opens `/{restaurant_slug}/{table_number}`
Then the server-side page issues an anonymous Supabase session with `app_metadata: { restaurant_id, table_number }` — no login prompt is shown
And the token expires after 2 hours with no rolling refresh (configured at Supabase project level, not in code)

**AC2** — Menu renders SSR immediately:
Given the anonymous session is issued
When the page renders via SSR
Then the restaurant's published menu is fetched server-side and rendered — the customer sees category tabs and items immediately, no splash screen or onboarding prompt
And the flow completes within 3 seconds on a mid-range mobile device over restaurant WiFi (NFR1)

**AC3** — Skeleton shown during slow load:
Given the page is loading
When the network is slow
Then the `MenuSkeleton` component is shown (category tab placeholders + 3 item row placeholders with grey image boxes)
And it is replaced with real content on completion — no layout shift

**AC4** — Offline/invalid QR shows error state:
Given the restaurant's menu is offline (`is_published = false`) or the slug/table number doesn't resolve to a valid record
When the page renders
Then the error state shows "This menu isn't available right now. Please ask your server." with no retry button

**AC5** — Anonymous session is RLS-scoped:
Given the anonymous session token is used
When it queries any table
Then it can only read published `menu_items` for the specific restaurant — cross-tenant access returns empty (RLS enforced, FR29)

## Tasks / Subtasks

- [x] Task 1: Update middleware to allow customer routes through without auth redirect (AC: 1, 2)
  - [x] Modify `lib/supabase/proxy.ts`: change the redirect condition from "redirect everything except `/`, `/login`, `/auth`" to "redirect only routes starting with `/admin`, `/platform`, `/protected`"
  - [x] Verify existing admin + auth redirects still work (no regression)

- [x] Task 2: Create `app/[restaurant_slug]/[table_number]/page.tsx` — SSR Server Component (AC: 1, 2, 4, 5)
  - [x] Resolve `restaurant_slug` → restaurant record using `createAdminClient()` — `.from('restaurants').select('id, name, slug, is_published').eq('slug', restaurant_slug).single()`
  - [x] Resolve `table_number` → table record — `.from('tables').select('id, number').eq('restaurant_id', restaurant.id).eq('number', tableNum).single()`
  - [x] If restaurant not found OR `!restaurant.is_published` OR table not found → return inline `<MenuUnavailable />` component (no `notFound()` — renders "This menu isn't available right now. Please ask your server.")
  - [x] Issue anonymous session server-side using `createClient()` from `lib/supabase/server.ts`:
    1. Call `supabase.auth.getSession()` to check for existing session
    2. Check if session exists AND `session.user.is_anonymous === true` AND `appMeta.restaurant_id === restaurant.id` — if all true, skip issuance (customer refreshing the page)
    3. Otherwise: call `supabase.auth.signInAnonymously()` to get `anonSession`
    4. Call `createAdminClient().auth.admin.updateUserById(anonSession.user.id, { app_metadata: { restaurant_id: restaurant.id, table_number: tableNum } })` to attach claims
    5. Call `supabase.auth.refreshSession()` to get updated JWT with custom claims from hook
  - [x] Fetch published menu data using `createAdminClient()` (service role — bypasses RLS for reliable SSR):
    - Categories: `.from('categories').select('id, name, display_order').eq('restaurant_id', restaurant.id).order('display_order')`
    - Items: `.from('menu_items').select('*').eq('restaurant_id', restaurant.id).eq('is_published', true).order('display_order')`
  - [x] Render: restaurant name header + `<CategoryTabs>` + item sections using `<MenuItemRow>` — pass `isAvailable={isItemAvailable(item.availability_schedule)}` (call `new Date()` once in the Server Component and pass it down)

- [x] Task 3: Create `app/[restaurant_slug]/[table_number]/loading.tsx` — skeleton fallback (AC: 3)
  - [x] Render `<MenuSkeleton />` — no logic needed

- [x] Task 4: Create `components/customer/MenuSkeleton.tsx` (AC: 3)
  - [x] Server Component (no state needed)
  - [x] Sticky tab bar placeholder: `div` with same height as real tab bar (`h-10`), 3 pill placeholders (`animate-pulse bg-surface-overlay rounded-full`)
  - [x] 3 item row placeholders: each row is `flex gap-3`, left 80×80px grey box (`animate-pulse bg-surface-overlay rounded-lg`), right 3 grey lines (name, description, price)
  - [x] Match layout exactly to prevent layout shift: same padding (`px-4 py-3`), same gap (`gap-3 flex-col`) as real items

- [x] Task 5: Create `components/customer/CategoryTabs.tsx` — Client Component (AC: 2)
  - [x] `'use client'` — needs `useState` for active tab, `useRef` for section elements
  - [x] Props: `categories: Category[]`, `hasUncategorized: boolean`
  - [x] Sticky tab bar: `sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2`
  - [x] Active tab style: `border-b-2 border-accent text-accent` (D1 design direction — `#FF6B35` via `border-accent` token)
  - [x] Inactive tab style: `text-text-secondary hover:text-text-primary`
  - [x] On tab click: smooth scroll to section using `document.getElementById(cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`
  - [x] IntersectionObserver for scroll-based tab highlight (same pattern as `components/admin/MenuPreview.tsx` lines 72–102 — copy that exact observer logic)

- [x] Task 6: Create `components/customer/MenuItemRow.tsx` — display-only for this story (AC: 2)
  - [x] `'use client'` — needed for future `onClick` in story 4-3; add `onTap?: () => void` prop now (leave as optional/undefined — wired up in story 4-3)
  - [x] Props: `item: MenuItem`, `isAvailable: boolean`, `onTap?: () => void`
  - [x] Accessibility: `role="button"`, `tabIndex={0}`, `aria-label={item.name + ', ' + formatPrice(item.price_cents)}`, min 44px touch target
  - [x] Layout: `flex gap-3 py-3 border-b border-border cursor-pointer`; `onClick={onTap}`, `onKeyDown` for Enter/Space → `onTap?.()` (keyboard support)
  - [x] Left: 80×80px food photo `rounded-lg object-cover` or grey placeholder if no image (same pattern as `ItemPhoto` in `components/admin/MenuPreview.tsx`)
  - [x] Right: name (max 2 lines, `line-clamp-2`), description (max 2 lines, `line-clamp-2 text-text-secondary`), price (`formatPrice(item.price_cents)`)
  - [x] Unavailable state: wrap with `opacity-60`, show "Not available right now" label in `text-xs text-text-tertiary` below price; `aria-disabled="true"` when not available
  - [x] Use `formatPrice` from `@/utils/formatPrice`
  - [x] Use `loading="lazy"` on image with explicit `width={80}` `height={80}` (no layout shift)

- [x] Task 7: Add `MenuUnavailable` inline component in `page.tsx` (AC: 4)
  - [x] No separate file — define as a small function inside `page.tsx` (or inline JSX)
  - [x] Full page centered: `flex min-h-screen items-center justify-center px-6 text-center`
  - [x] Copy: "This menu isn't available right now. Please ask your server."
  - [x] No retry button, no restaurant branding (restaurant may not be found)

- [x] Task 8: Write unit tests (AC: 2)
  - [x] Create `tests/unit/customer/MenuItemRow.test.tsx`
  - [x] Test: available item renders name, price, description
  - [x] Test: unavailable item shows "Not available right now" label and has `aria-disabled="true"`
  - [x] Test: item without image renders placeholder (no broken img tag)
  - [x] Test: `onTap` called when row is clicked (and when Enter/Space pressed)

### Review Findings (AI — 2026-05-17)

- [x] [Review][Decision] Anonymous session cannot persist from Server Component — resolved via Option 2 (Server Action): created `actions/customerActions.ts` with `initAnonymousSession()` Server Action and `components/customer/SessionInitializer.tsx` Client Component that calls it via `useEffect`; session block removed from page.tsx
- [x] [Review][Patch] Add NaN guard for non-numeric table_number path segment — `if (isNaN(tableNum)) return <MenuUnavailable />` added after parseInt
- [x] [Review][Patch] Unhandled error from `updateUserById` silently corrupts session metadata — resolved in `customerActions.ts` with explicit `ActionResult` error propagation
- [x] [Review][Patch] `UNCATEGORIZED_KEY` duplicated in page.tsx and CategoryTabs.tsx — extracted to `utils/customerMenu.ts`; both files now import from shared constant
- [x] [Review][Defer] Stale `sectionOrderRef` when categories prop changes [components/customer/CategoryTabs.tsx:21] — deferred, pre-existing pattern from MenuPreview; Server Component passes static props so categories don't change after mount
- [x] [Review][Defer] `getSession()` used instead of `getClaims()` for session existence check [app/[restaurant_slug]/[table_number]/page.tsx:55] — deferred, low risk in this context (session not used for privileged queries); will be resolved when session issuance is refactored
- [x] [Review][Defer] `select('*')` fetches all menu_items columns including any future internal fields [app/[restaurant_slug]/[table_number]/page.tsx:81] — deferred, stale generated types require wildcard select; revisit when types are regenerated

## Dev Notes

### BLOCKING: Middleware Must Be Updated First

**Current `lib/supabase/proxy.ts` redirects ANY unauthenticated request (except `/`, `/login`, `/auth*`) to `/auth/login`.**

Customer QR routes (`/{slug}/{table}`) will be intercepted and redirected before the page ever renders. Fix this before building the customer page — otherwise nothing works.

**Change in `lib/supabase/proxy.ts`:**
```typescript
// BEFORE (redirects customer routes):
if (
  request.nextUrl.pathname !== "/" &&
  !user &&
  !request.nextUrl.pathname.startsWith("/login") &&
  !request.nextUrl.pathname.startsWith("/auth")
) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  return NextResponse.redirect(url);
}

// AFTER (only protects admin/platform/protected):
const protectedPrefixes = ['/admin', '/platform', '/protected']
if (
  !user &&
  protectedPrefixes.some(prefix => request.nextUrl.pathname.startsWith(prefix))
) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  return NextResponse.redirect(url);
}
```

This keeps admin/platform/protected routes guarded while allowing:
- Customer routes `/{slug}/{table}` (anonymous session issued in page.tsx)
- The root `/` (already allowed before)
- Auth routes `/auth/*` (already allowed before)

### Anonymous Session Issuance — Server-Side in page.tsx

The anonymous session is issued in the Server Component `page.tsx` using two Supabase clients:

1. **`createClient()` from `lib/supabase/server.ts`** — cookie-based SSR client; manages the customer's session cookies
2. **`createAdminClient()` from `lib/supabase/admin.ts`** — service role; used for restaurant/table lookup AND for `auth.admin.updateUserById()` to attach `app_metadata`

**Three-step session flow** (same pattern as `tests/rls/helpers.ts → createAnonCustomerClient`, lines 73–96):
1. `supabase.auth.signInAnonymously()` → creates anonymous user + sets session cookies
2. `adminClient.auth.admin.updateUserById(userId, { app_metadata: { restaurant_id, table_number } })` → attaches context
3. `supabase.auth.refreshSession()` → triggers `custom_access_token_hook` to inject `app_metadata` into JWT

**IMPORTANT — Session check before issuance:**
```typescript
const { data: { session } } = await supabase.auth.getSession()
const appMeta = session?.user?.app_metadata as { restaurant_id?: string; table_number?: number } | undefined

const needsNewSession = 
  !session || 
  session.user.is_anonymous !== true || 
  appMeta?.restaurant_id !== restaurant.id

if (needsNewSession) {
  // Issue new anonymous session (3-step flow above)
}
```
This prevents creating a new anonymous user on every page refresh.

**2-hour expiry**: Configured at Supabase project level (Authentication → JWT expiry). No rolling refresh means the client should NOT call `refreshSession()` after the initial setup. This is a project configuration, not code behavior.

**PREREQUISITE: `custom_access_token_hook` must be registered**
- Supabase Dashboard → Authentication → Hooks → Custom Access Token → `public.custom_access_token_hook`
- Without this, `app_metadata` won't be injected into JWTs and RLS policies will fail
- Documented in `tests/rls/anonymous-session.spec.ts` (line 11–16) and deferred-work.md

### Menu Data Fetch — Use Admin Client (Service Role)

Use `createAdminClient()` for both restaurant/table resolution AND menu data fetch. Do NOT use the cookie-based `createClient()` for data queries in this story — the anonymous session's JWT may not yet have the correct `app_metadata` claims during the server render (the hook runs on refresh, which happens after the initial sign-in).

**Query pattern:**
```typescript
const adminClient = createAdminClient()

// Resolve restaurant
const { data: restaurant } = await adminClient
  .from('restaurants')
  .select('id, name, slug, is_published')
  .eq('slug', restaurant_slug)
  .single()

// Resolve table
const { data: table } = await adminClient
  .from('tables')
  .select('id, number')
  .eq('restaurant_id', restaurant.id)
  .eq('number', tableNum)
  .single()

// Fetch categories (ordered)
const { data: categories } = await adminClient
  .from('categories')
  .select('id, name, display_order')
  .eq('restaurant_id', restaurant.id)
  .order('display_order')

// Fetch published items only
const { data: items } = await adminClient
  .from('menu_items')
  .select('id, restaurant_id, category_id, name, description, price_cents, image_url, display_order, variants, availability_schedule, is_published')
  .eq('restaurant_id', restaurant.id)
  .eq('is_published', true)
  .order('display_order')
```

### CategoryTabs — Reuse IntersectionObserver Pattern from MenuPreview

`components/admin/MenuPreview.tsx` (lines 72–102) has the exact IntersectionObserver logic for scroll-based tab highlighting. Copy that pattern verbatim into `CategoryTabs.tsx`. Do NOT reinvent it.

The scroll-to-section on tab click:
```typescript
document.getElementById(cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
```

Section elements in the page must have `id={cat.id}` and `className="scroll-mt-14"` to account for the sticky tab bar height.

### MenuItemRow — Mirrors ItemRow in MenuPreview, But in Customer Namespace

`components/admin/MenuPreview.tsx` has a local `ItemRow` and `ItemPhoto` sub-component (lines 14–57). The `MenuItemRow` in `components/customer/` is the interactive customer version of that same component. Look at the admin version for layout reference but build it independently in the customer namespace — they will diverge significantly in story 4-3 (ItemConfigSheet, add-to-cart).

**Key difference from admin version:**
- `role="button"` and `tabIndex={0}` for accessibility (admin version has none)
- `onTap` prop (optional now, required in story 4-3)
- `aria-label`, `aria-disabled` (admin version has none)

### MenuSkeleton — Match Real Layout Exactly

The skeleton must prevent layout shift. Match:
- Same `px-4` horizontal padding as content
- Same `py-3` row padding as `MenuItemRow`
- Same `gap-3` spacing as item list
- Category tab bar: same `h-10` height and `border-b border-border` border

Use `animate-pulse` Tailwind class and `bg-surface-overlay` token for grey boxes.

### Route Structure

This story creates a new route group at the top level:
```
app/
  [restaurant_slug]/
    [table_number]/
      page.tsx    ← NEW (Server Component — session + data fetch + render)
      loading.tsx ← NEW (renders MenuSkeleton)
```

**No `error.tsx`** — the "menu unavailable" case (slug not found, not published, table not found) is handled inline in `page.tsx` by returning early with a JSX error state. `error.tsx` is for uncaught runtime errors (React error boundary). Data-not-found is not an uncaught error.

### Type Casting for JSONB Columns

`variants` and `availability_schedule` columns come back from Supabase as raw `Json` type. Cast them at the query boundary:
```typescript
items.map(item => ({
  ...item,
  variants: (item.variants as VariantGroup[]) ?? [],
  availability_schedule: (item.availability_schedule as AvailabilitySchedule | null) ?? null,
}))
```
This is the pre-existing pattern from `app/admin/menu/[item_id]/page.tsx` and `MenuPreview`.

### What This Story Does NOT Build

- `stores/cartStore.ts` — story 4-3
- `components/customer/ItemConfigSheet.tsx` — story 4-3
- `components/customer/CartBar.tsx` — story 4-3
- `components/customer/OrderConfirmationScreen.tsx` — story 4-5
- `actions/orderActions.ts` — story 4-5
- Any Admin UI changes — untouched

### What Must NOT Change

- `lib/supabase/proxy.ts` logic for `/admin`, `/platform`, `/protected` routes (must still redirect to `/auth/login`)
- All existing admin UI components and pages
- `types/app.ts` — no new types needed for this story
- `utils/isAvailable.ts`, `utils/formatPrice.ts` — used as-is

### Previous Story Intelligence (Story 3.2 Learnings)

- **Dialog focus trap still deferred**: All dialogs in the project lack focus traps — this is pre-existing across the codebase. Don't add one for this story either; stay consistent.
- **`router.refresh()` pattern**: After mutations, Server Component pages re-fetch. This story doesn't have mutations (SSR-only), so no `router.refresh()` needed.
- **Review patches focus on a11y details**: The code reviewer checks `aria-modal="true"`, `role="alert"`, and dialog ID uniqueness. Pre-wire `role="button"`, `aria-label`, and `aria-disabled` on `MenuItemRow` correctly from the start to avoid review patches.

### References

- [Source: lib/supabase/proxy.ts] — current middleware auth redirect logic (lines 51–60); must be updated to allow customer routes
- [Source: lib/supabase/server.ts] — `createClient()` for cookie-based SSR sessions
- [Source: lib/supabase/admin.ts] — `createAdminClient()` for service role queries + `auth.admin.updateUserById()`
- [Source: tests/rls/helpers.ts lines 73–96] — `createAnonCustomerClient` — the exact 3-step anonymous session pattern (signInAnonymously → updateUserById → refreshSession)
- [Source: tests/rls/anonymous-session.spec.ts lines 11–16] — prerequisite: `custom_access_token_hook` must be registered in Supabase Dashboard before any anonymous session test works
- [Source: components/admin/MenuPreview.tsx lines 14–57] — `ItemPhoto` and `ItemRow` sub-components; reference layout for `MenuItemRow`
- [Source: components/admin/MenuPreview.tsx lines 72–102] — IntersectionObserver scroll-tracking pattern for `CategoryTabs`
- [Source: types/app.ts] — `MenuItem`, `Category`, `VariantGroup`, `AvailabilitySchedule`, `ActionResult`
- [Source: utils/formatPrice.ts] — `formatPrice(priceCents: number): string`
- [Source: utils/isAvailable.ts] — `isItemAvailable(schedule, now): boolean` — call with one `new Date()` from the Server Component
- [Source: utils/generateQrUrl.ts] — QR URL is `{NEXT_PUBLIC_APP_URL}/{slug}/{table_number}`; route must match this exact pattern
- [Source: _bmad-output/planning-artifacts/architecture.md — "QR URL Structure"] — `app/[restaurant_slug]/[table_number]/page.tsx` is the correct route path
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Component Strategy"] — `MenuItemRow` accessibility spec: `role="button"`, `aria-label="{name}, {price}"`, min 44px touch target
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — "Design Direction"] — D1: `surface-base (#FFFFFF)` background, `border-bottom: 2px solid #FF6B35` for active tab (use `border-accent` token)
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.1] — AC1–5 verbatim
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `custom_access_token_hook` registration is manual (cannot be automated); verify it's registered before testing anonymous session

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Middleware updated to scope auth redirect to `/admin`, `/platform`, `/protected` only — customer QR routes now pass through
- SSR page at `app/[restaurant_slug]/[table_number]/page.tsx` implements full 3-step anonymous session flow (signInAnonymously → updateUserById → refreshSession) with page-refresh idempotency check
- Admin client (`service role`) used for all data queries to bypass RLS during SSR, avoiding the race where the anonymous JWT hasn't yet received `app_metadata` claims from the hook
- `select('*')` used for `menu_items` query with `as MenuItem` cast, consistent with the project pattern in `menuActions.ts` — generated Supabase types are stale and don't include `image_url`, `display_order`, `variants`, `availability_schedule`
- `CategoryTabs` reuses IntersectionObserver logic verbatim from `MenuPreview.tsx`; section IDs are resolved via `document.getElementById` rather than stored refs (Server Component renders sections, Client Component observes them)
- `MenuItemRow` pre-wires `onTap?: () => void` and full a11y attributes (`role="button"`, `aria-label`, `aria-disabled`) ready for story 4-3
- 10 new unit tests added for `MenuItemRow` covering all AC2-related behaviors; all 197 tests pass with zero regressions

### File List

- lib/supabase/proxy.ts (modified)
- app/[restaurant_slug]/[table_number]/page.tsx (new)
- app/[restaurant_slug]/[table_number]/loading.tsx (new)
- components/customer/MenuSkeleton.tsx (new)
- components/customer/CategoryTabs.tsx (new)
- components/customer/MenuItemRow.tsx (new)
- tests/unit/customer/MenuItemRow.test.tsx (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/4-1-qr-scan-anonymous-session-menu-load.md (modified)

## Change Log

- 2026-05-17: Implemented story 4.1 — customer QR route, anonymous session issuance, SSR menu render, skeleton, CategoryTabs, MenuItemRow, MenuUnavailable, unit tests (197/197 pass)
- 2026-05-17: Addressed code review findings — 4 items resolved: session moved to Server Action (SessionInitializer), NaN guard added, updateUserById errors propagated, UNCATEGORIZED_KEY extracted to utils/customerMenu.ts (201/201 pass)
