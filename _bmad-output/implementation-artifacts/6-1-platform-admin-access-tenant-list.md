# Story 6.1: Platform Admin Access & Tenant List

Status: done

## Story

As a platform admin,
I want to log in to a protected admin panel and see a list of all registered restaurants,
so that I can quickly find any tenant when a support issue arises.

## Acceptance Criteria

1. **Given** a user with `is_platform_admin: true` on their `profiles` row navigates to `/platform`
   **When** the layout checks the DB flag server-side
   **Then** access is granted and the tenant list page at `/platform/tenants` renders (FR40)

2. **Given** a user with `is_platform_admin: false` (including any restaurant owner) navigates to `/platform`
   **When** the layout checks
   **Then** they are redirected to `/auth/login` — no platform admin content is visible and no privilege escalation path exists (NFR8)

3. **Given** the platform admin is on the tenant list
   **When** the page renders
   **Then** all registered restaurants are listed with name, slug, signup date, and published status

4. **Given** the tenant list is long
   **When** the admin types in the search input
   **Then** restaurants are filtered by name (case-insensitive) — the list is functional for a support lookup

---

## Tasks / Subtasks

- [x] **Task 1 — `app/platform/layout.tsx` — is_platform_admin guard** (AC: #1, #2)
  - [x] Create `app/platform/layout.tsx` as a Server Component
  - [x] `createClient()` from `@/lib/supabase/server` → `auth.getUser()` — if no user, `redirect('/auth/login')`
  - [x] Query `profiles`: `.from('profiles').select('is_platform_admin').eq('id', user.id).single()`
  - [x] If `!profile?.is_platform_admin`, `redirect('/auth/login')` — covers both "no profile" and "flag is false"
  - [x] Render minimal layout shell: `<div className="min-h-screen bg-surface-base">{children}</div>` — NO `AdminNav`, NO `RealtimeProvider` (separate surface per architecture)
  - [x] No `app/platform/page.tsx` needed for this story — layout redirect handles root `/platform` navigation correctly; the canonical page is `/platform/tenants`

- [x] **Task 2 — `app/platform/tenants/page.tsx` — Tenant list Server Component** (AC: #3)
  - [x] Create `app/platform/tenants/page.tsx` as a Server Component (no `'use client'`)
  - [x] Use `createAdminClient()` from `@/lib/supabase/admin` — service role needed to read ALL restaurants cross-tenant (regular authenticated client is RLS-blocked)
  - [x] Fetch: `.from('restaurants').select('id, name, slug, created_at, is_published').order('created_at', { ascending: false })` — no `.eq('restaurant_id', ...)` filter, this IS the cross-tenant read
  - [x] Map `data ?? []` to `TenantRow[]` and pass to `<TenantList restaurants={restaurants} />`
  - [x] Page wrapper: `<main className="p-6"><h1 className="mb-6 text-2xl font-semibold text-text-primary">Tenants</h1><TenantList ... /></main>`

- [x] **Task 3 — `components/platform/TenantList.tsx` — Client Component with search** (AC: #3, #4)
  - [x] Create `components/platform/TenantList.tsx` with `'use client'` directive
  - [x] Define `TenantRow` interface locally: `{ id: string; name: string; slug: string; created_at: string; is_published: boolean }`
  - [x] `useState<string>('')` for search term
  - [x] Filter: `restaurants.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))` — empty string shows all
  - [x] Render: `<input type="search" placeholder="Search by name…" value={query} onChange={e => setQuery(e.target.value)} className="..." />`
  - [x] Render `<ul>` — one `<li>` per filtered restaurant with name, slug, signup date, published badge
  - [x] Empty filtered state: "No restaurants match"
  - [x] Empty all-tenants state: "No restaurants registered yet."

- [x] **Task 4 — Unit tests for TenantList** (AC: #3, #4)
  - [x] Create `tests/unit/platform/TenantList.test.tsx`
  - [x] `makeTenant(overrides)` helper — factory for `TenantRow`
  - [x] 10 tests passing: all restaurants shown when empty search; case-insensitive filter; hides non-matching; "No restaurants match" message; Published badge; Offline badge; slug shown; signup date includes year; clears filter; empty list state

- [x] **Task 5 — Add `createTestPlatformAdmin` helper + E2E smoke test** (AC: #1, #2)
  - [x] Added `createTestPlatformAdmin` to `tests/rls/helpers.ts`
  - [x] Create `tests/e2e/platform-admin-access.spec.ts`
  - [x] `beforeAll`: create 2 test restaurants + owner + 1 platform admin user
  - [x] **Test 1 — Platform admin can access tenant list**: sign in, navigate to `/platform/tenants`, assert both restaurants visible + heading + search input
  - [x] **Test 2 — Regular owner is redirected from /platform**: sign in as owner, navigate to `/platform`, assert URL does NOT contain `/platform`
  - [x] `afterAll`: cleanup test users and restaurants via helpers

### Review Findings (2026-05-18)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) returned 27 raw findings. After dedupe + triage: 0 decision-needed, 6 patches, 7 deferred, 9 dismissed.

**Patch (applied):**

- [x] [Review][Patch] **Search input lacks accessible label (WCAG)** [components/platform/TenantList.tsx:31] — applied: added `aria-label="Search restaurants by name"`. New unit test asserts the input is reachable via `getByLabelText(/search restaurants by name/i)`.
- [x] [Review][Patch] **Owner-redirect E2E test does not verify target is `/auth/login`** [tests/e2e/platform-admin-access.spec.ts:55-58] — applied: assertion now uses `page.waitForURL((url) => url.pathname === '/auth/login')` + `expect(page.url()).toContain('/auth/login')`, matching AC#2 literal wording.
- [x] [Review][Patch] **Negative test only covers logged-in owner, not unauthenticated user** [tests/e2e/platform-admin-access.spec.ts] — applied: added third test case "unauthenticated visitor is redirected to /auth/login from /platform/tenants" that navigates without signing in and asserts the redirect.
- [x] [Review][Patch] **`ownerUserId` captured but never cleaned up explicitly** [tests/e2e/platform-admin-access.spec.ts:30,36] — applied: removed unused `ownerUserId` variable; documented in `afterAll` that `cleanupTestRestaurants` handles owner cleanup via the restaurant FK cascade sweep.
- [x] [Review][Patch] **`signIn` helper does not await post-login navigation** [tests/e2e/platform-admin-access.spec.ts:42-44] — applied: `signIn` now awaits `page.waitForURL(/\/admin/)` after the login button click; matches the `realtime-order-delivery.spec.ts` pattern.
- [x] [Review][Patch] **Whitespace-only search query produces misleading "No match" with quoted spaces** [components/platform/TenantList.tsx:23-25] — applied: `const trimmed = query.trim()` is used both for the filter check and for the "no match" message. New unit test asserts that a `"   "` query shows all restaurants without triggering the "no match" message.

**Deferred (real but out of MVP scope):**

- [x] [Review][Defer] **No pagination on tenant list — unbounded result set** [app/platform/tenants/page.tsx:7-10] — deferred; spec did not specify a limit; support tool with low tenant count for MVP. Revisit if tenant count grows beyond ~500.
- [x] [Review][Defer] **No CSRF/auth check pattern for future /platform Server Actions** [app/platform/layout.tsx] — deferred; no Server Actions exist under `/platform/` yet. When Story 6.2 adds inspection mutations (if any), they MUST re-check `is_platform_admin` independently.
- [x] [Review][Defer] **`toLocaleDateString()` formats differ per browser locale** [components/platform/TenantList.tsx:43] — deferred; support tool used by one operator, acceptable for MVP. Future: use a fixed format like `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`.
- [x] [Review][Defer] **Filtered count not announced for screen readers** [components/platform/TenantList.tsx:30-65] — deferred; a11y polish. Future: wrap result count in `<div role="status" aria-live="polite">{filtered.length} of {restaurants.length} restaurants</div>`.
- [x] [Review][Defer] **Server Component discards Supabase error from `restaurants` fetch** [app/platform/tenants/page.tsx:7-10] — deferred; if query fails, page renders "No restaurants registered yet" — indistinguishable from a true empty state. Requires error-UX design decision (error boundary? toast? specific empty state?).
- [x] [Review][Defer] **`createTestPlatformAdmin` partial-failure leaks auth.users row** [tests/rls/helpers.ts:63-78] — deferred; if `auth.admin.createUser` succeeds but profile `.insert` fails, the auth user is orphaned. Same shape as existing `createTestOwner` helper — fixing this should be a sweep across all helpers, not 6.1-scoped.
- [x] [Review][Defer] **Page Server Component admin-client query may execute even when layout redirects** [app/platform/tenants/page.tsx:5-9] — deferred; Next.js parallelizes layout + page render; the admin client SELECT executes even if layout calls `redirect()`. Data never reaches the user (redirect aborts response), but query latency and log noise occur. Matches existing app/admin/orders pattern; layer-the-fix is project-wide.

**Dismissed (9):** Blind #1 admin-client use (documented architecture: `docs/conventions/supabase-clients.md` — service role is the correct client for cross-tenant reads, layout is the auth source of truth); Blind #2/#14 profile-query error swallowed (matches established `app/admin/layout.tsx` pattern; same `single()` semantics); Blind #3 redirect to `/auth/login` while authenticated (matches spec wording explicitly); Blind #5 search excludes slug (spec AC#4 says "by name", not slug); Blind #10 duplicate TEST_PASSWORD literal (matches existing `realtime-order-delivery.spec.ts` and `order-mark-handled.spec.ts` pattern; helpers does not export it); Blind #11 `is_platform_admin` column migration (column was added in Story 1-2 — Blind Hunter is blind by design); Blind #12 / EC-1 / A-2 `.insert()` vs `.upsert()` (existing `tests/rls/platform-admin.spec.ts` uses identical `.insert()` pattern with no trigger conflict in this project); Blind #17 empty-state message order (rendering "No restaurants registered yet" when restaurants is empty is more accurate than "No match for query" — the issue is upstream, not filter); Blind #19 `TenantRow` type duplicates `restaurants` columns (spec explicitly required local interface definition).

---

## Dev Notes

### Critical Context

**Building on Stories 1-1, 1-2, and 1-4.** Everything this story needs is already in place:
- `profiles.is_platform_admin` boolean column (default false) — from Story 1-2
- `tests/rls/platform-admin.spec.ts` already passes — RLS enforcement is verified; this story is about the UI layer
- `createAdminClient()` exists at `lib/supabase/admin.ts` — service role, bypasses RLS
- `createClient()` (cookie-based server) exists at `lib/supabase/server.ts`
- Auth cookie session pattern is established in `app/admin/layout.tsx` — follow the same guard pattern

**Deferred work W3 resolves here**: The `AdminLayout` note said "platform admin verification to be added in Story 6.1". This means creating `app/platform/layout.tsx` with the `is_platform_admin` check. Do NOT touch `app/admin/layout.tsx` — its `restaurant_id` guard is correct for owner access. Platform admins visiting `/admin` are harmlessly redirected to `/auth/onboarding` (they have no restaurant_id — acceptable).

**Completely separate surface**: `app/platform/` has its own layout with no `AdminNav`, no `RealtimeProvider`, no Zustand order store. Architecture doc: "separate layout with is_platform_admin check; no shared state with admin surface."

**Why `createAdminClient()` for the tenant list**: Regular authenticated clients on Supabase obey RLS. A platform admin user's JWT is still scoped to their own profile; they have no `restaurant_id`, so `SELECT` on `restaurants` returns nothing via RLS. The admin client (service role) bypasses RLS and can read all tenants. This is the documented correct use: "Server-side reads where RLS would otherwise block." The platform admin layout.tsx gate ensures only authenticated `is_platform_admin` users ever trigger this code path.

**No middleware.ts needed**: `app/platform/layout.tsx` runs server-side on every navigation within `/platform/*`. This provides the same protection as middleware for this subtree and is consistent with how `app/admin/layout.tsx` handles restaurant-owner auth.

**No redirect from layout root**: The layout does NOT redirect `/platform` → `/platform/tenants` unless using `redirect()`. For Story 6.1, simply having `app/platform/tenants/page.tsx` is sufficient. The user navigates directly to `/platform/tenants`. An optional redirect from `/platform` to `/platform/tenants` (via `app/platform/page.tsx`) would be a polish step — not required for AC satisfaction.

### Architecture Compliance

**Client selection** (see `docs/conventions/supabase-clients.md`):
- `app/platform/layout.tsx`: `createClient()` (cookie-based server) — checking `is_platform_admin` on the currently-signed-in user
- `app/platform/tenants/page.tsx`: `createAdminClient()` (service role) — cross-tenant read; regular client blocked by RLS

**Tailwind tokens** — do NOT hardcode hex values:
- `bg-accent text-white` — Published badge
- `bg-border text-text-secondary` — Offline badge
- `text-text-primary` — primary text
- `text-text-secondary` — secondary/meta text
- `bg-surface-base` — page background

**No ActionResult needed**: The tenant list page is a Server Component data fetch with no mutation — no Server Action, no `ActionResult<T>`.

**No `.select()` after INSERT/UPDATE** is not relevant here (reads only). The 42501 overload rule applies to writes only.

### Existing Code Being Read (READ BEFORE IMPLEMENTING)

**`app/admin/layout.tsx`** — guard pattern to replicate:
```tsx
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/auth/login')
const { data: profile } = await supabase.from('profiles').select('restaurant_id').eq('id', user.id).single()
if (!profile?.restaurant_id) redirect('/auth/onboarding')
```
Platform version: same shape, different field (`is_platform_admin`) and different redirect target (`/auth/login` for both no-user and not-admin cases).

**`tests/rls/helpers.ts`** — existing helpers to build on:
- `getServiceClient()`, `createTestRestaurant()`, `createTestOwner()`, `signInAsOwner()`, `cleanupTestRestaurants()`, `cleanupTestUsers()` — all available for reuse in the new e2e spec
- Add `createTestPlatformAdmin()` following the exact same pattern as `createTestOwner()` but with `restaurant_id: null, is_platform_admin: true`

**`tests/e2e/realtime-order-delivery.spec.ts`** — e2e spec pattern to follow:
- `describe/beforeAll/afterAll` structure with cleanup
- `signIn(page)` async helper that uses Playwright `page.goto/fill/click`

### File Structure (ALL NEW)

| Path | NEW/UPDATE | Notes |
|------|-----------|-------|
| `app/platform/layout.tsx` | NEW | `is_platform_admin` guard, minimal shell |
| `app/platform/tenants/page.tsx` | NEW | Server Component, admin client fetch |
| `components/platform/TenantList.tsx` | NEW | Client Component, search + list |
| `tests/unit/platform/TenantList.test.tsx` | NEW | Filter + render unit tests |
| `tests/rls/helpers.ts` | UPDATE | Add `createTestPlatformAdmin` |
| `tests/e2e/platform-admin-access.spec.ts` | NEW | E2E access control + tenant list |

### Testing Standards

- Unit: `vitest --run`, `@testing-library/react`, jsdom — same as every other unit test in this project
- E2E: Playwright, `tests/e2e/*.spec.ts`, uses `tests/rls/helpers.ts`; requires live Supabase instance (`supabase start`)
- Unit test file location: `tests/unit/platform/` — new subfolder, consistent with `tests/unit/admin/`
- No RLS-level tests needed for this story — `tests/rls/platform-admin.spec.ts` already covers RLS enforcement (from Story 1-2)

### Previous Story Intelligence (from 5-2)

- Confirmed pattern: `'use server'` + `ActionResult<T>` for Server Actions — not applicable here (no mutations)
- Confirmed: deferred-work items W3 are the only Epic-6 specific carryforward — resolved by Task 1
- Testing: e2e tests import from `tests/rls/helpers.ts` — not `tests/e2e/helpers.ts`
- Sign-in pattern in e2e: `page.goto('/auth/login')`, `getByLabel('Email').fill(email)`, `getByLabel('Password').fill(password)`, `getByRole('button', { name: /log in/i }).click()`, then `waitForURL(/\/admin/)` — for platform admin, wait for `/platform` or `/platform/tenants`

### References

- Architecture: `_bmad-output/planning-artifacts/architecture.md` — "Platform Admin Designation", "Complete Project Directory Structure", "Component Boundaries"
- Epics: `_bmad-output/planning-artifacts/epics.md` — Epic 6, Story 6.1 AC
- Client conventions: `docs/conventions/supabase-clients.md` — admin client use case
- PRD: `_bmad-output/planning-artifacts/prd.md` — FR40, NFR8

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Task 1: `app/platform/layout.tsx` — Server Component guard using `createClient()` + `profiles.is_platform_admin` check. Both unauthenticated users and non-admin users redirect to `/auth/login`. No `AdminNav` or `RealtimeProvider` — fully separate surface.
- Task 2: `app/platform/tenants/page.tsx` — Server Component using `createAdminClient()` (service role) to fetch all restaurants cross-tenant. Passes `TenantRow[]` to client component. No `.eq()` tenant scoping — this IS the intentional cross-tenant admin read.
- Task 3: `components/platform/TenantList.tsx` — `'use client'` with `useState` search filter. Case-insensitive `includes()` match. Published/Offline badge with `bg-accent text-white` / `bg-border text-text-secondary` tokens. Two empty states: no-restaurants and no-filter-matches.
- Task 4: 10 unit tests covering all AC-relevant scenarios. All pass. No regressions (327/327 unit tests pass).
- Task 5: Added `createTestPlatformAdmin()` to `tests/rls/helpers.ts`. E2E spec at `tests/e2e/platform-admin-access.spec.ts` covers both AC#1 (admin access) and AC#2 (owner redirect). Uses same `beforeAll/afterAll` cleanup pattern as existing e2e tests.
- TypeScript: no errors in new files; pre-existing errors in earlier story files are unrelated.

### File List

- `app/platform/layout.tsx` (NEW)
- `app/platform/tenants/page.tsx` (NEW)
- `components/platform/TenantList.tsx` (NEW)
- `tests/unit/platform/TenantList.test.tsx` (NEW)
- `tests/rls/helpers.ts` (UPDATE — added `createTestPlatformAdmin`)
- `tests/e2e/platform-admin-access.spec.ts` (NEW)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-05-18: Implemented Story 6.1 — Platform Admin Access & Tenant List. Created platform route tree (`app/platform/`) with `is_platform_admin` guard, tenant list Server Component using admin client for cross-tenant reads, `TenantList` Client Component with case-insensitive search filter. Added 10 unit tests and E2E smoke test covering access control for both platform admin and regular owner. Added `createTestPlatformAdmin` helper to shared test helpers.
- 2026-05-18: Code review applied — 6 patches resolved. Added `aria-label` to search input; tightened E2E redirect assertions to require `/auth/login` target; added third E2E test for unauthenticated visitor; `signIn` helper now awaits post-login navigation; removed unused `ownerUserId` variable; `TenantList` filter now trims the query so whitespace-only input shows all restaurants. Added 2 unit tests (whitespace-trim, aria-label) — 329 unit tests pass.
