# Story 1.3: Restaurant Owner Signup & Restaurant Profile Creation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a restaurant owner,
I want to create an account with my email and set up my restaurant profile (name and unique slug) through self-serve signup,
so that I can access the Admin UI and begin configuring my restaurant without contacting support.

## Acceptance Criteria

1. **Given** a prospective owner visits `/auth/sign-up` **When** they enter a valid email and password and submit **Then** a Supabase Auth account is created and a `profiles` row is inserted with `is_platform_admin: false` **And** they are prompted to enter their restaurant name and choose a URL slug

2. **Given** an owner enters a restaurant slug **When** they move focus away from the slug field **Then** client-side validation checks the slug against `^[a-z0-9-]{3,50}$` and shows an inline error below the field if invalid

3. **Given** an owner submits a slug that is already taken **When** the server-side uniqueness check runs **Then** an inline error ("This URL is already in use — try another") is shown without clearing the name or other fields

4. **Given** valid signup data with a unique slug **When** the form is submitted **Then** a `restaurants` row is inserted linked to the owner's `profiles.restaurant_id` **And** the owner is redirected to `/admin` with the Admin UI dashboard visible **And** the OnboardingChecklist is rendered on the dashboard with all steps in incomplete state

5. **Given** a signed-up owner navigates to any `/admin` route **When** their Supabase queries execute **Then** RLS returns only their own restaurant's data — no other tenant's data is accessible

## Tasks / Subtasks

- [x] Task 1: Database — `handle_new_user` trigger + restaurants INSERT migration (AC: 1, 4)
  - [x] Apply migration via Supabase MCP: create `public.handle_new_user()` trigger function that INSERTs into `profiles (id, is_platform_admin) VALUES (NEW.id, false)` on AFTER INSERT ON auth.users
  - [x] Create trigger: `on_auth_user_created` AFTER INSERT ON auth.users EXECUTE PROCEDURE public.handle_new_user()
  - [x] Verify trigger fires: confirmed via `information_schema.triggers` query — trigger present on auth.users INSERT
  - [x] Confirm Supabase autoconfirm is enabled (Authentication → Settings → "Confirm email" OFF) — required for session to be active immediately after signUp()

- [x] Task 2: Create `lib/supabase/admin.ts` — service role client (AC: 4)
  - [x] Create `lib/supabase/admin.ts` exporting `createAdminClient()` using `SUPABASE_SERVICE_ROLE_KEY`
  - [x] Never call this from client components — server-side only (Server Actions, API routes)

- [x] Task 3: Create `utils/validateSlug.ts` (AC: 2)
  - [x] Export `isValidSlugFormat(slug: string): boolean` — tests `^[a-z0-9-]{3,50}$`
  - [x] Used client-side in the signup form on blur

- [x] Task 4: Create `actions/authActions.ts` — `createRestaurant` Server Action (AC: 3, 4)
  - [x] Create `actions/authActions.ts`
  - [x] Implement `createRestaurant({ name, slug }: { name: string; slug: string }): Promise<ActionResult<{ restaurantId: string }>>`
  - [x] In action: get current user via `createClient()` from `lib/supabase/server.ts`
  - [x] Server-side slug uniqueness check: uses admin client (user client can't see other restaurants — RLS filters to zero rows for new user with null restaurant_id)
  - [x] INSERT restaurant using `createAdminClient()` (service role — no user-level INSERT policy on restaurants)
  - [x] UPDATE `profiles.restaurant_id = newRestaurantId` using the user's SSR client (covered by `owner_update_own_profile` policy)
  - [x] Return `{ success: true, data: { restaurantId } }` on success
  - [x] Never throw — all errors return `{ success: false, error: string }`

- [x] Task 5: Rewrite signup flow — `components/sign-up-form.tsx` (AC: 1, 2, 3, 4)
  - [x] Rewrite `components/sign-up-form.tsx` as a 2-step multi-step form Client Component
  - [x] Step 1: Email + password fields; on submit calls `supabase.auth.signUp({ email, password })` (client-side); on success advances to Step 2 (no redirect — show Step 2 inline)
  - [x] Step 2: Restaurant name (required) + slug (required) fields
  - [x] Slug field: validate on blur using `isValidSlugFormat()` — show inline error below field if invalid
  - [x] Step 2 submit: call `createRestaurant({ name, slug })` Server Action
  - [x] On `success: true`: redirect to `/admin` using `router.push('/admin')`
  - [x] On `success: false`: show inline error below slug field (do NOT clear name field)
  - [x] Error copy for auth failures: existing Supabase error message (preserve as-is)
  - [x] Loading state on both submit buttons: disable + show spinner text

- [x] Task 6: Update `app/auth/sign-up/page.tsx` (AC: 1)
  - [x] No layout change needed — existing centered card layout is correct
  - [x] The page simply renders `<SignUpForm />` — verified, no changes needed

- [x] Task 7: Create Admin UI layout + dashboard (AC: 4, 5)
  - [x] Create `app/admin/layout.tsx` — Server Component; check auth via `createClient()` from `lib/supabase/server.ts`; if no session redirect to `/auth/sign-up`; render `{children}`
  - [x] Create `app/admin/page.tsx` — Server Component; render `<OnboardingChecklist />` with all steps incomplete

- [x] Task 8: Create `components/admin/OnboardingChecklist.tsx` (AC: 4)
  - [x] Server Component (no interactivity needed for Story 1.3)
  - [x] Render 5 steps in order: "Add menu items" · "Preview menu" · "Publish menu" · "Create tables" · "Print QR codes"
  - [x] All steps render in `incomplete` state for Story 1.3 (later stories update state)
  - [x] Each step: `CheckCircle2` (complete, muted) / `Circle` (incomplete, accent) from lucide-react + label + CTA Link
  - [x] Progress indicator: "0 of 5 steps complete"
  - [x] Component returns `null` when all steps complete (auto-hides — Story 2.7 wires real state)

### Review Findings

**Code review complete.** 1 `decision-needed`, 10 `patch`, 5 `defer`, 10 dismissed as noise.

**Decision-Needed:**
- [x] [Review][Decision] D1: Admin layout guards — redirect mid-onboarding users (no `restaurant_id`) to `/auth/onboarding`; unauthenticated users to `/auth/sign-up` — `app/admin/layout.tsx` ✅ Fixed

**Patch:**
- [x] [Review][Patch] P1: Add `import 'server-only'` guard to prevent accidental client-side import of service role key [`lib/supabase/admin.ts`] ✅ Fixed
- [x] [Review][Patch] P2: Trigger function missing `SET search_path = public` — SECURITY DEFINER function vulnerable to search_path injection [`supabase/migrations/20260510000002_fix_handle_new_user_trigger.sql`] ✅ Fixed
- [x] [Review][Patch] P3: Migration missing `DROP TRIGGER IF EXISTS` / `DROP FUNCTION IF EXISTS` — migration fails on re-run [`supabase/migrations/20260510000002_fix_handle_new_user_trigger.sql`] ✅ Fixed
- [x] [Review][Patch] P4: Slug regex `^[a-z0-9-]{3,50}$` allows leading/trailing/consecutive hyphens (e.g. `---`, `-abc`, `abc-`) [`utils/validateSlug.ts`] ✅ Fixed
- [x] [Review][Patch] P5: Orphaned restaurant row if `profiles.restaurant_id` update fails — add compensating DELETE on profile error [`actions/authActions.ts`] ✅ Fixed
- [x] [Review][Patch] P6: TOCTOU race — slug SELECT+INSERT can be beaten by concurrent requests; rely on unique constraint violation catch instead of pre-check [`actions/authActions.ts`] ✅ Fixed
- [x] [Review][Patch] P7: `createRestaurant()` missing server-side validation — empty name / invalid slug format bypass client validation [`actions/authActions.ts`] ✅ Fixed
- [x] [Review][Patch] P8: Fragile error routing via `result.error.includes("already in use")` — use typed error codes to route errors in the form [`actions/authActions.ts`, `components/sign-up-form.tsx`] ✅ Fixed
- [x] [Review][Patch] P9: No guard prevents a user with an existing `restaurant_id` from calling `createRestaurant()` again — creates orphaned duplicates [`actions/authActions.ts`] ✅ Fixed
- [x] [Review][Patch] P10: Profile UPDATE doesn't verify rows affected — silent 0-rows update returns success with unlinked restaurant [`actions/authActions.ts`] ✅ Fixed

**Defer:**
- [x] [Review][Defer] W1: `emailRedirectTo` missing in `signUp()` call — ✅ Implemented in correct-course fix (2026-05-10): added `emailRedirectTo: ${origin}/auth/confirm?next=/auth/onboarding` + "Check your email" step 3 UI [`components/sign-up-form.tsx`]
- [x] [Review][Defer] W2: Admin layout redirects unauthenticated users to `/auth/sign-up` instead of `/auth/sign-in` — story 1.4 builds sign-in route [`app/admin/layout.tsx`] — deferred, pre-existing
- [x] [Review][Defer] W3: Stale slug validation error persists after user clears the slug field — UX polish [`components/sign-up-form.tsx`] — deferred, pre-existing
- [x] [Review][Defer] W4: Double-submit race — rapid double-click before React state update disables button [`components/sign-up-form.tsx`] — deferred, pre-existing
- [x] [Review][Defer] W5: Autoconfirm OFF is a required manual prerequisite not enforced by code — documented but not guarded [`supabase/config.toml`] — deferred, pre-existing

## Dev Notes

### ⚠️ Critical Deviations (from Architecture Doc — Established in Stories 1.1 and 1.2)

**Supabase client path:** `lib/supabase/` — NOT `utils/supabase/`
- `lib/supabase/server.ts` → `createClient()` — SSR cookie-based client
- `lib/supabase/client.ts` → `createClient()` — browser client
- `lib/supabase/admin.ts` → `createAdminClient()` — NEW in this story (service role)

**Env var key:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — NOT `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Auth route path:** `app/auth/sign-up/` — NOT `app/(auth)/signup/`
- Do NOT create new routes at `app/(auth)/` — the existing `app/auth/` structure must be used

**Admin route path:** `app/admin/` is NEW in this story — create it fresh

### Admin Client Pattern (`lib/supabase/admin.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**NEVER import this in a Client Component** — `SUPABASE_SERVICE_ROLE_KEY` is server-only.

### Database Trigger (apply via Supabase MCP migration)

```sql
-- Auto-create a profiles row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, is_platform_admin)
  VALUES (NEW.id, false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Why trigger instead of Server Action for profiles INSERT:**
- The trigger fires at the DB level regardless of the client path
- Story 1.2 explicitly called this out as the intended mechanism
- It's reliable even if step 1 of signup succeeds but step 2 is never reached

### `createRestaurant` Server Action Pattern

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/app'

export async function createRestaurant(
  input: { name: string; slug: string }
): Promise<ActionResult<{ restaurantId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Server-side uniqueness check
  const { data: existing } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle()
  if (existing) return { success: false, error: 'This URL is already in use — try another' }

  // INSERT restaurant using admin client (no user-level INSERT policy on restaurants)
  const admin = createAdminClient()
  const { data: restaurant, error: insertError } = await admin
    .from('restaurants')
    .insert({ name: input.name, slug: input.slug })
    .select('id')
    .single()
  if (insertError || !restaurant) {
    return { success: false, error: insertError?.message ?? 'Failed to create restaurant' }
  }

  // UPDATE profile using user client (covered by owner_update_own_profile policy)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ restaurant_id: restaurant.id })
    .eq('id', user.id)
  if (profileError) return { success: false, error: profileError.message }

  return { success: true, data: { restaurantId: restaurant.id } }
}
```

### Multi-Step Signup Form Flow

```
Step 1: Email + Password
  → supabase.auth.signUp() [client-side, browser supabase client]
  → trigger fires → profiles row auto-created (restaurant_id = null)
  → on success: setStep(2) — show Step 2 UI in same card, no page navigation
  → on error: show inline error, preserve email field

Step 2: Restaurant Name + Slug
  → client-side slug format validation on blur (isValidSlugFormat)
  → on submit: createRestaurant() Server Action
  → on success: router.push('/admin')
  → on error: show inline error below slug field, preserve name field
```

### Slug Validation (`utils/validateSlug.ts`)

```typescript
const SLUG_REGEX = /^[a-z0-9-]{3,50}$/

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_REGEX.test(slug)
}
```

Client-side: call on blur. Error copy: "Slug must be 3–50 lowercase letters, numbers, or hyphens"

### RLS: Why `restaurants` INSERT Uses Service Role

The `restaurants` table has no INSERT policy for the `authenticated` role (only SELECT and UPDATE policies exist from Story 1.2). The signup is the one privileged operation that must bypass user-level RLS for restaurant creation. The admin client is used server-side only, so this is safe.

After the restaurant is created and `profiles.restaurant_id` is set, all subsequent queries from the owner go through `get_my_restaurant_id()` which returns their restaurant UUID — RLS enforces full isolation from that point.

### Admin Layout Auth Guard (`app/admin/layout.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-up')
  return <>{children}</>
}
```

**Note:** Full admin navigation shell (sidebar, bottom tab bar) is deferred to later stories. This story only needs the auth guard and the dashboard page with OnboardingChecklist.

### `app/admin/page.tsx` Pattern

```typescript
import { createClient } from '@/lib/supabase/server'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'

export default async function AdminPage() {
  // Restaurant data fetched here in later stories for checklist state
  // For Story 1.3: render checklist with all steps incomplete
  return (
    <main>
      <h1>Welcome to your Admin Dashboard</h1>
      <OnboardingChecklist
        hasMenuItems={false}
        hasPreviewedMenu={false}
        isPublished={false}
        hasTables={false}
        hasPrintedQr={false}
      />
    </main>
  )
}
```

### OnboardingChecklist Component Props

```typescript
interface OnboardingChecklistProps {
  hasMenuItems: boolean
  hasPreviewedMenu: boolean
  isPublished: boolean
  hasTables: boolean
  hasPrintedQr: boolean
}
```

Story 1.3 renders with all `false`. Later stories pass real values. Component auto-hides when all are `true`.

Steps in order:
1. "Add menu items" — CTA: `/admin/menu` (link, disabled in Story 1.3)
2. "Preview menu" — CTA: `/admin/menu/preview`
3. "Publish menu" — CTA: publish action (wired in Story 2.7)
4. "Create tables" — CTA: `/admin/tables`
5. "Print QR codes" — CTA: `/admin/tables` (same page, download action)

Use `lucide-react` icons: `CheckCircle2` (complete, muted text), `Circle` (incomplete, full opacity).

### Supabase Autoconfirm Requirement

For the multi-step flow to work (step 2 runs in the same browser session immediately after step 1), Supabase must have email confirmation **disabled**:

- Hosted project: Authentication → Settings → "Enable email confirmations" → OFF
- Local Supabase: `supabase/config.toml`:
  ```toml
  [auth]
  enable_confirmations = false
  ```

Without autoconfirm, `supabase.auth.signUp()` returns a user but no active session — Step 2 would fail (no auth context for the Server Action).

### What Existing Files to Update vs Create

**UPDATE** (already exist — read before modifying):
- `components/sign-up-form.tsx` — full rewrite for 2-step flow
- `app/auth/sign-up/page.tsx` — likely no change needed (verify it just renders `<SignUpForm />`)
- `types/app.ts` — no change needed for this story

**CREATE** (new files):
- `lib/supabase/admin.ts`
- `utils/validateSlug.ts`
- `actions/authActions.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `components/admin/OnboardingChecklist.tsx`

**DO NOT create** (conflicts with existing structure):
- `utils/supabase/` — does not exist, use `lib/supabase/`
- `app/(auth)/` — does not exist, use `app/auth/`

### Testing This Story

No automated tests required for this story (P0 RLS tests already pass). Manual verification:
1. Visit `/auth/sign-up` → fill email + password → submit
2. Step 2 appears → enter restaurant name + slug → submit
3. Redirected to `/admin` dashboard
4. OnboardingChecklist visible with 0/5 steps complete
5. Sign out → visit `/admin` → redirected to `/auth/sign-up`
6. Sign in as a different owner → confirm Supabase queries only return their restaurant's data

### Project Structure Notes

- **Route path for signup:** `app/auth/sign-up/page.tsx` (NOT `app/(auth)/signup/page.tsx`)
- **Admin route:** `app/admin/` — new directory; create `layout.tsx` and `page.tsx`
- **Admin components:** `components/admin/OnboardingChecklist.tsx` — matches architecture directory structure
- **Server Actions:** `actions/authActions.ts` — matches architecture `actions/` directory
- **Utilities:** `utils/validateSlug.ts` — matches architecture `utils/` directory
- **Admin client:** `lib/supabase/admin.ts` — lives in `lib/supabase/` alongside existing clients

### References

- [Source: epics.md#Story 1.3 — Restaurant Owner Signup & Restaurant Profile Creation]
- [Source: architecture.md#Authentication & Security — Owner Authentication, Platform Admin Designation]
- [Source: architecture.md#API & Communication Patterns — QR URL Structure, slug validation]
- [Source: architecture.md#Format Patterns — Server Action Return Format, Supabase Query Pattern]
- [Source: architecture.md#Project Structure — actions/, utils/, components/admin/, lib/supabase/]
- [Source: architecture.md#Enforcement Guidelines — ActionResult<T>, price_cents, RLS]
- [Source: 1-2-database-schema-rls-policies-security-foundation.md#Dev Notes — Critical Deviation: Supabase Client Path]
- [Source: 1-2-database-schema-rls-policies-security-foundation.md#Dev Notes — Critical: Env Var Key Name]
- [Source: 1-2-database-schema-rls-policies-security-foundation.md#Dev Notes — RLS Policies: Restaurant Owners]
- [Source: 1-2-database-schema-rls-policies-security-foundation.md#Completion Notes — profiles INSERT policy added]
- [Source: ux-design-specification.md#Component 7 — OnboardingChecklist]
- [Source: ux-design-specification.md#Journey 2 — Marco: First-Time Setup]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **handle_new_user trigger verified**: Applied via Supabase MCP migration `handle_new_user_trigger`. Confirmed in `information_schema.triggers` — fires AFTER INSERT ON auth.users. Uses `ON CONFLICT (id) DO NOTHING` to be idempotent.
- **Critical RLS insight for slug uniqueness**: New user's authenticated client cannot see any restaurants (RLS `get_my_restaurant_id()` returns null → zero rows). Fixed to use admin client for both uniqueness check AND restaurant INSERT.
- **vitest config created**: Added `vitest.config.ts` to exclude `tests/rls/` and `tests/e2e/` from vitest run (those are Playwright tests requiring env vars). All 7 unit tests pass cleanly.
- **Autoconfirm note**: The 2-step signup flow requires Supabase autoconfirm OFF. If this is not set, step 2 will fail (no active session). Must be enabled in Supabase Dashboard → Authentication → Settings.

### Completion Notes List

- **AC 1 (Signup + profiles row)**: `handle_new_user` trigger auto-inserts profiles row on auth user creation. Step 1 of signup form calls `supabase.auth.signUp()` client-side; on success, advances to Step 2 inline.
- **AC 2 (Slug validation)**: `utils/validateSlug.ts` exports `isValidSlugFormat()`. Called on blur in `components/sign-up-form.tsx`. 6 unit tests covering valid/invalid cases.
- **AC 3 (Slug uniqueness)**: `createRestaurant()` Server Action checks uniqueness via admin client (bypasses RLS for new users), returns `{ success: false, error: "This URL is already in use — try another" }` on conflict.
- **AC 4 (Restaurant creation + redirect + dashboard)**: `createRestaurant()` inserts restaurant via admin client, updates `profiles.restaurant_id` via user client. Success redirects to `/admin`. Dashboard renders `OnboardingChecklist` with 0/5 steps complete.
- **AC 5 (RLS isolation)**: `app/admin/layout.tsx` guards all `/admin` routes. Post-signup, `get_my_restaurant_id()` returns the new restaurant UUID — all owner queries are automatically scoped. RLS already enforced from Story 1.2.

### File List

- `supabase/migrations/20260510000001_handle_new_user_trigger.sql` (NEW)
- `lib/supabase/admin.ts` (NEW — service role client, server-side only)
- `utils/validateSlug.ts` (NEW — `isValidSlugFormat()` slug format validator)
- `actions/authActions.ts` (NEW — `createRestaurant()` Server Action)
- `components/sign-up-form.tsx` (UPDATED — 2-step multi-step signup form)
- `app/admin/layout.tsx` (NEW — auth guard, redirects unauthenticated to `/auth/sign-up`)
- `app/admin/page.tsx` (NEW — Admin dashboard with OnboardingChecklist)
- `components/admin/OnboardingChecklist.tsx` (NEW — 5-step onboarding guide, auto-hides when all complete)
- `tests/unit/validateSlug.test.ts` (NEW — 6 unit tests for slug validation)
- `vitest.config.ts` (NEW — excludes RLS/E2E tests from vitest run)

### Change Log

- 2026-05-10: Story 1.3 implemented. handle_new_user DB trigger applied. 2-step signup form rewritten. createRestaurant Server Action with admin-client slug uniqueness check. Admin layout + dashboard + OnboardingChecklist created. 7/7 unit tests passing.
