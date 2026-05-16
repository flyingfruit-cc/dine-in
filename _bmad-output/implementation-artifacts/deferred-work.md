# Deferred Work

## Deferred from: code review of 1-1-project-initialization-infrastructure-setup (2026-05-09)

- `global_fetch_strictly_public` flag in `wrangler.toml` blocks private/loopback IPs — only relevant when using `wrangler dev` against local Supabase; not blocking for CF production. Revisit when local wrangler dev workflow is tested.
- `CLOUDFLARE_ACCOUNT_ID` not injected in CI deploy job — wrangler may auto-detect from API token; verify during first actual deploy and add explicit secret if multi-account token is used.
- `instrumentation.ts` Sentry init may not fire on Cloudflare Workers runtime — `NEXT_RUNTIME` checks cover `nodejs` and `edge` but CF Workers via OpenNext may use a different label; needs testing post-first-deploy.
- `next`, `@supabase/ssr`, `@supabase/supabase-js` pinned to `"latest"` in `package.json` — any `npm install` will silently bump these; only `package-lock.json` guards stability. Consider pinning to exact versions in a future hardening pass.

## Deferred from: code review of 1-2-database-schema-rls-policies-security-foundation (2026-05-09)

- `custom_access_token_hook` registration cannot be automated via SQL or MCP — must be done manually in Supabase Dashboard → Authentication → Hooks. No pre-flight check enforces this before the test suite runs. Consider adding a smoke test in `beforeAll` that verifies `auth.jwt() -> 'app_metadata'` returns the expected shape.
- `Date.now()` suffix in test describe blocks theoretically collides if parallel Playwright workers start within the same millisecond — in practice highly unlikely, but a `crypto.randomUUID()` slice would be more robust.

## Deferred from: code review of 1-3-restaurant-owner-signup-restaurant-profile-creation (2026-05-10)

- W1: `emailRedirectTo` missing in `supabase.auth.signUp()` — deferred until story 1.4 builds email confirmation flow; default project URL is used until then.
- W2: Admin layout (`app/admin/layout.tsx`) redirects unauthenticated users to `/auth/sign-up` instead of `/auth/sign-in` — deferring to story 1.4 which creates the sign-in route.
- W3: Stale slug validation error persists after user clears the slug field — UX polish, clear `slugError` in `onChange` handler.
- W4: Double-submit race on step buttons — `isLoading` state disables on re-render but rapid double-click could race state; low risk, UX polish.
- W5: Autoconfirm OFF is a required manual prerequisite for the 2-step signup flow — documented in story Dev Notes but not enforced by code; needs a setup runbook or smoke-test check.

## Deferred from: code review of 1-4-admin-ui-authentication-login-logout-password-reset (2026-05-10)

- W1: No confirm-password field in `UpdatePasswordForm` — pre-existing UX gap; single-field password update risks typo lockout; add confirm field in a future UX hardening pass.
- W2: No rate-limiting guard on `resetPasswordForEmail` — standard React `isLoading` pattern is used; for production, consider server-side rate limiting or Supabase's built-in rate limits as sufficient.
- W3: `AdminLayout` doesn't verify platform-admin role — Epic 6 scope; current restaurant_id guard is correct for restaurant-owner access; platform admin verification to be added in Story 6.1.
- W4: `createClient()` rejection unhandled in `signOut` Server Action — pre-existing pattern across all server actions; missing env vars would fail app startup before any request reaches this code.
- W5: `UpdatePasswordForm` shows cryptic Supabase error when user lands on page without a recovery session — error IS displayed via `setError(error.message)`, but UX could be improved with a session pre-check and friendlier messaging.

## Deferred from: code review of 2-1-category-management (2026-05-10)

- D1: MenuPage relies solely on RLS for restaurant scoping — no explicit `.eq('restaurant_id', restaurantId)` defense-in-depth filter. Pre-existing architectural pattern; story Dev Notes explicitly documents RLS as the scoping layer. Revisit during production hardening.
- D2: display_order concurrent race condition — COUNT/MAX-based display_order is not atomic; two concurrent creates can assign the same value. True atomicity requires a DB-level sequence or function. Deferred to Story 2.5 which owns full category reordering.
- D3: No duplicate category name prevention at any layer — no uniqueness constraint in schema, no app-level check. Not an AC requirement for Story 2.1; revisit if UX spec calls for it.
- D4: MenuPage page-level auth guard absent — intentional per story Dev Notes; `app/admin/layout.tsx` handles auth for the entire /admin tree. No action needed unless layout is changed.

## Deferred from: code review of 2-2-menu-item-creation-edit-delete (2026-05-10)

- `formatPrice` does not handle negative values — prices are never negative in domain; concern only if negative price_cents ever enters the DB. Revisit if discount/adjustment features are added.
- `deleteMenuItem` returns `{ success: true }` for a no-op delete — RLS scoping means this can only happen if a stale item ID is submitted; add `count` check in a future hardening pass.
- `localItems` not synced with refreshed `items` prop — client-only state initialised from server props; requires `router.refresh()` or `useEffect` on props to stay in sync. Deferred to future story with page revalidation.
- `MenuItem` type missing `updated_at` field — field not in current schema; add to type and migration when last-modified display is needed.
- `MenuItemUpdate` allows empty-object no-op — TypeScript-level nicety; not a functional bug. Add `RequireAtLeastOne<MenuItemUpdate>` utility type in a future hardening pass.
- Edit page (`[item_id]/page.tsx`) relies solely on RLS for restaurant scoping — spec-acknowledged pattern (story Dev Notes explicitly note this). Add explicit `.eq('restaurant_id', restaurantId)` as defence-in-depth in a future story.

## Deferred from: code review of 2-3-item-variants-pricing (2026-05-12)

- `toMenuItem` bare `as VariantGroup[]` cast — no shape validation against malformed JSONB in `actions/menuActions.ts`; DB `NOT NULL DEFAULT '[]'` is the real guard. Add runtime shape validation in a future hardening pass.
- No server-side non-negative validation on `price_cents` for variant options — pre-existing pattern; client `min="0"` is the only guard. Add server-side bounds check when backend validation layer is introduced.
- No upper bound on number of variant groups in `VariantEditor` — intentional per spec (only options capped at 6); revisit as product decision if unbounded JSONB growth becomes a concern.
- Floating-point rounding imprecision in `updateOptionPrice` via `Math.round(parseFloat(v) * 100)` — shared pattern with main item price field; affects edge decimal values (e.g. $2.555 → 255¢ instead of 256¢). Fix with `Math.round(parseFloat((+v).toFixed(2)) * 100)` in a future hardening pass.
- Variant-only edits on new items silently discarded before name is typed — `!name.trim()` guard in `MenuItemForm.tsx` predates variants; no user warning given. Revisit UX when name-less draft saving is considered.

## Deferred from: code review of 2-4-item-availability-scheduling (2026-05-16)

- Timezone mismatch: `isItemAvailable` uses process/browser local timezone, not the restaurant's configured timezone. No timezone field in `AvailabilitySchedule`. Requires schema change + TZ selection UI; deferred to post-MVP hardening.
- No UI warning when schedule is enabled but `days: []` — item is silently unavailable to customers with no owner feedback. UX polish; not an AC requirement.
- No validation when `start_time >= end_time` — produces a permanently-unavailable window with no error or warning in the editor. Spec documents overnight schedules are unsupported; add time-order validation in a future UX hardening pass.
- Bare `as AvailabilitySchedule | null` type cast in `app/admin/menu/[item_id]/page.tsx` — no runtime JSONB shape validation. Pre-existing pattern (same file also has bare `as VariantGroup[]` cast); add runtime shape validation in a future hardening pass.
