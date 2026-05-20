# Story 1.5: Restaurant Settings — View & Edit Profile

Status: done

> **Note:** This story file was retroactively backfilled on 2026-05-20. The work itself was implemented on 2026-05-17 (commit `9e682ae`, "modify: renew menu admin UI") bundled with the broader admin UI refresh, without going through the standard `create-story` workflow. This document captures the as-built state and the ACs already satisfied — it is not a forward-looking implementation plan.

## Story

As a restaurant owner,
I want to view my restaurant name and URL slug in the Admin Settings page and update my restaurant name if needed,
So that I can correct onboarding mistakes and always know my customer-facing URL.

## Acceptance Criteria

1. **Given** an authenticated owner navigates to `/admin/settings` **When** the page renders **Then** the current restaurant name is shown in an editable text field **And** the URL slug is shown as read-only, prefixed as `dine-in/{slug}` **And** a note explains that the slug cannot be changed after setup

2. **Given** an owner edits their restaurant name and clicks "Save" **When** `updateRestaurantName()` completes **Then** `restaurants.name` is updated for their restaurant **And** an inline success message is shown

3. **Given** an owner submits an empty restaurant name **When** the form validates **Then** an inline error is shown and no DB update is made

4. **Given** an authenticated owner is on any admin page **When** the Admin navigation renders **Then** a "Settings" tab is present and navigates to `/admin/settings` with active-state highlighting

## Tasks / Subtasks

- [x] Task 1: Add `updateRestaurantName` Server Action to `actions/restaurantActions.ts` (AC: 2, 3)
  - [x] Trim input; reject empty trimmed value with `{ success: false, error: 'Restaurant name cannot be empty' }` — server-side empty-name guard satisfies AC 3
  - [x] Use `getAuthContext()` helper (already in file) to resolve `restaurantId` from `profiles.restaurant_id`
  - [x] Update `restaurants.name` scoped by `id = restaurantId` — RLS provides defense-in-depth even though the action also filters by ID
  - [x] Return `ActionResult<void>` discriminated union per project convention — never throws

- [x] Task 2: Build settings page Server Component at `app/admin/settings/page.tsx` (AC: 1)
  - [x] `createClient()` (server/cookie client) → `select('name, slug').from('restaurants').single()` — RLS scopes the row to the owner's restaurant
  - [x] Render `<RestaurantSettings name={...} slug={...} />` with safe fallbacks (`?? ''`)
  - [x] Page layout: `max-w-2xl`, "Settings" h1, design-md tokens only

- [x] Task 3: Build `RestaurantSettings` Client Component at `components/admin/RestaurantSettings.tsx` (AC: 1, 2, 3)
  - [x] Editable `restaurant-name` input with `required` attribute (browser-level empty-name guard) + server-side guard from Task 1
  - [x] Read-only slug field rendered as `dine-in/{slug}` with the note: "Your URL cannot be changed — it's embedded in your printed QR codes."
  - [x] Form submit calls `updateRestaurantName(name)`, awaits the `ActionResult`
  - [x] Success: render `role="status"` green "Restaurant name updated." message
  - [x] Error: render `role="alert"` red error text from `result.error`
  - [x] Both messages clear when the input changes — no stale feedback
  - [x] Button uses project standard `bg-accent text-white rounded-xl`; disabled + "Saving…" while in-flight
  - [x] Bonus (not in spec): "Change password →" link to `/auth/update-password` in a secondary "Account" section

- [x] Task 4: Add Settings tab to `components/admin/AdminNav.tsx` (AC: 4)
  - [x] `Settings` entry with `lucide-react` icon, `exact: false` so any `/admin/settings*` route shows active state
  - [x] Visible in both mobile bottom tab bar and desktop left sidebar variants

## Dev Notes

### Why this story had no spec file at implementation time

This work was rolled into commit `9e682ae` ("modify: renew menu admin UI", 2026-05-17) which also touched the menu builder. The umbrella commit bypassed `bmad-create-story`, so the per-story implementation artifact was never generated. Sprint-status.yaml didn't track Story 1.5 either, which is how the gap stayed hidden until 2026-05-20 sprint planning audit caught it.

**Prevention:** When a sprint-change-proposal adds a story, follow it with `bmad-create-story` (or manually add the entry to `sprint-status.yaml`) before starting implementation. See `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17b.md` which is where Story 1.5 was introduced.

### Slug is immutable — server-side enforcement

The spec calls for the slug to be read-only in the UI. The implementation also enforces this in `updateRestaurantName`: only `name` is updated, never `slug`. There is no Server Action exposed for slug changes anywhere in the codebase, so even a malicious client cannot mutate the slug through this surface. The slug remains the QR-code-stable identifier.

### Server Component + Client Component split

- `app/admin/settings/page.tsx` is async Server Component — fetches restaurant data via the cookie client (`@/lib/supabase/server`) using RLS for scoping
- `components/admin/RestaurantSettings.tsx` is `'use client'` because it needs form state, optimistic UI feedback, and calls a Server Action via the browser

The cookie client is correct here because this is an **owner-authenticated** page (not customer-sessionless). Per `project-context.md`, only customer-facing SSR uses the admin client.

### Auth scoping

The admin layout (`app/admin/layout.tsx`) handles the auth guard for the entire `/admin` subtree. The settings page itself does not re-check `getUser()` — pre-existing convention across all admin pages. Defence-in-depth is provided by RLS on the `restaurants` table.

## File List

### Files Created
- `app/admin/settings/page.tsx`
- `components/admin/RestaurantSettings.tsx`

### Files Modified
- `actions/restaurantActions.ts` — added `updateRestaurantName(name: string): Promise<ActionResult<void>>`
- `components/admin/AdminNav.tsx` — added Settings tab entry

### Files Verified (no changes)
- `app/admin/layout.tsx` — existing auth guard covers `/admin/settings`
- RLS on `public.restaurants` — existing tenant isolation policies cover this surface

## Gaps & Deferred Items

These were NOT in the as-built state and are deferred:

- [ ] **No unit test for `updateRestaurantName`** — `tests/unit/menu/restaurantActions.test.ts` covers `publishMenu`, `takeMenuOffline`, and `recordMenuPreview`, but not `updateRestaurantName`. A follow-up should add three tests mirroring the existing pattern: (1) returns error when not authenticated, (2) returns error when no restaurant found, (3) calls update with trimmed name and returns success, (4) returns error when DB update fails, (5) returns "Restaurant name cannot be empty" for empty/whitespace input.
- [ ] **No `restaurant_id` filter on update** — `updateRestaurantName` filters by `id = restaurantId`, which is correct but relies on RLS for cross-tenant defense. Pre-existing pattern across other actions in `restaurantActions.ts`; not a regression.
- [ ] **Success state never auto-dismisses** — the "Restaurant name updated." message persists until the input is touched again. Not in spec; minor UX nit.
- [ ] **`getAuthContext` is duplicated across actions files** — `restaurantActions.ts`, `menuActions.ts`, and others each define a local `getAuthContext`. Already flagged in deferred work for several other stories (e.g. 2-7, 3-1). Project-wide refactor topic.
- [ ] **`Promise<ActionResult<void>>` returning `{ success: true, data: undefined }`** — the `data: undefined` field is required by the discriminated union but is awkward when the success case carries no payload. Consider a `Promise<ActionResult<void>>` variant in `types/app.ts` that omits `data` when `T = void`. Not a regression.

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-05-17 | Implementation merged in commit `9e682ae` ("modify: renew menu admin UI") | (umbrella commit, no per-story author) |
| 2026-05-20 | Story file retroactively backfilled from as-built state; sprint-status.yaml updated `1-5-restaurant-settings-view-edit-profile: backlog → done`; Epic 1 promoted to done | sprint-planning audit |
