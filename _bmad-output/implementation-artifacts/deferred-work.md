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

## Deferred from: code review of 2-5-item-reordering-within-category (2026-05-16)

- TOCTOU race on `display_order` in `createMenuItem` — two concurrent creates for the same category can read the same MAX and insert duplicate order values. True fix requires a DB-level sequence or `SELECT FOR UPDATE`. Post-MVP per story dev notes.
- Non-atomic `reorderMenuItems` batch — `Promise.all` partial failure leaves DB with a mix of old and new `display_order` values. Full atomicity via Supabase `rpc()` transaction is post-MVP per story dev notes.
- No max-length guard on `updates` array — an authenticated owner can send a very large payload causing `Promise.all` fan-out against the DB connection pool. Revisit when server-action input validation layer is added.
- Stale `previousItems` snapshot during concurrent overlapping drags — rollback restores a snapshot that may miss interleaved optimistic mutations from a second drag. Extremely unlikely UX scenario on a menu admin page.
- Migration `ROW_NUMBER` backfill is non-deterministic for items sharing an identical `created_at` timestamp — add `ORDER BY created_at ASC, id ASC` tiebreaker if bulk imports become a supported workflow.
- `arrayMove` on a 1-item category still fires `reorderMenuItems` — harmless extra call; add `categoryItems.length <= 1` guard in a future cleanup pass.

## Deferred from: code review of 2-6-menu-preview (2026-05-16)

- Active tab not updated on scroll — AC4 only requires click-to-scroll; scroll-based tab tracking via IntersectionObserver is a future UX enhancement.
- Code duplication between categorized and uncategorized item render blocks — extract shared `MenuItemRow` sub-component in Epic 4 refactor when customer components are built.
- No error handling on Supabase queries in page component — matches established project pattern (same as `app/admin/menu/page.tsx`); add a shared error boundary in a future hardening pass.
- Unpublished items shown without visual indicator — admin preview intentionally shows all items including unpublished; if a visual indicator is desired, add to Story 2.7 scope.
- `now` stale over long session — acceptable for a preview page unlikely to stay mounted indefinitely; add periodic refresh if real-time availability indication becomes a requirement.
- `select('*')` fetches all columns — project-wide pattern across all page.tsx files; switch to explicit column selection in a future performance hardening pass.
- No page metadata (`generateMetadata`) on preview page — not in story scope; add with page title/description in a future polish pass.
- No loading/suspense boundary on preview page — not in story scope; add `loading.tsx` sibling in a future polish pass.
- `availability_schedule` time string format validation — pre-existing gap in `utils/isAvailable.ts`; add `HH:MM` format guard in that utility when data integrity hardening is prioritized.
- `categories` prop change stale `activeTab` — not applicable in current SSC pattern (props are stable); revisit if the preview is ever made to live-reload.

## Deferred from: code review of 3-1-table-creation-qr-code-generation-download (2026-05-17)

- Admin page-level auth relies solely on layout + RLS with no explicit `getUser()` guard in `TablesPage` — pre-existing pattern across all admin pages; add page-level session check in a future hardening pass.
- `getAuthContext()` `.single()` error silently masked — profile query error is indistinguishable from missing profile row; pre-existing pattern from `menuActions.ts`; fix with shared auth utility in a future refactor.
- `generateQrUrl` hardcodes `https://app.dine-in-cc.com` production domain — staging/dev QR codes point to production; intentional per architecture spec; revisit when staging environment is set up.

## Deferred from: code review of 3-2-table-deletion-qr-code-invalidation (2026-05-17)

- No focus trap on TableCard delete dialog — keyboard users can Tab behind the overlay; same pre-existing gap as all other dialogs (see 2-7 deferred item); address in an accessibility hardening pass.
- Fixed overlay stacking-context: `fixed inset-0` dialog rendered inside card div rather than a portal — parent CSS `transform`/`filter` would break fixed positioning; same pattern as MenuItemList.tsx; address if layout ever introduces transforms around the table list.
- Backdrop click does not dismiss TableCard delete dialog — same pattern as MenuItemList.tsx and CategoryManager.tsx across the whole project; add in a future UX/accessibility pass.
- `deleteTable` returns `{ success: true }` for a no-op (zero rows matched) — Supabase DELETE with no matching rows returns no error; `router.refresh()` is called as if deletion succeeded; same pattern as `deleteMenuItem`/`deleteCategory`; add row-count assertion in a future defensive hardening pass.

## Deferred from: code review of 2-7-menu-publish-offline-control-onboarding-checklist (2026-05-16)

- Dialog (take-offline confirmation) has no focus trap and does not restore focus to trigger button on close — implement FocusLock or native `inert` when an accessibility hardening pass is prioritized.
- `getAuthContext` discards profile query error — transient DB failure is indistinguishable from a missing profile; pre-existing pattern from `menuActions.ts`, fix in a shared auth utility refactor.
- `publishMenu`/`takeMenuOffline`/`recordMenuPreview` return success when 0 rows updated — Supabase UPDATE under RLS produces no error on zero-row result; add row-count assertion (or `select()` after update) in a defensive hardening pass.
- `isPublished` prop briefly stale between `setIsSubmitting(false)` and RSC re-render from `router.refresh()` — inherent App Router pattern; consider adding a local optimistic `isPending` state if perceived latency becomes an issue.
- Supabase generated types not regenerated after `has_previewed_menu` migration — `types/supabase.ts` diverges from actual schema; run `supabase gen types` and commit as part of the next migration or schema-change routine.
- `OnboardingChecklist` can never reach `allComplete=true` while `hasTables`/`hasPrintedQr` are hardcoded `false` — by design (Epic 3 scope); wire real values in story 3-1.
- Double `getAuthContext` auth round trips per action call — each action re-fetches user + restaurant_id; pre-existing pattern from `menuActions.ts`; consolidate with a shared session utility in a future refactor.
- "Take offline" button has no `aria-label` associating it with the menu — low-impact; add `aria-label="Take menu offline"` in an accessibility pass.

## Deferred from: code review of 4-1-qr-scan-anonymous-session-menu-load and 4-2-menu-browsing-by-category-with-availability-filtering (2026-05-17)

- Stale `sectionOrderRef` in `CategoryTabs.tsx` when categories prop changes — Server Component passes static props so categories don't change after mount; low real-world risk. Revisit if CategoryTabs is ever used with dynamic props.
- `getSession()` used in `page.tsx` for session existence check rather than `getClaims()` — low risk since the session is not used for privileged data queries (all data fetched via admin client). Will be resolved when anonymous session issuance is refactored out of the Server Component.
- `select('*')` on `menu_items` fetches all columns — necessary workaround for stale Supabase generated types that don't include `image_url`, `display_order`, `variants`, `availability_schedule`. Revisit when `supabase gen types` is run after the next migration.
- Server timezone mismatch for availability schedule checks — `isItemAvailable` uses server UTC clock; schedules have no timezone field. Pre-existing in `utils/isAvailable.ts`. Add timezone support to `AvailabilitySchedule` type in a future enhancement.

## Deferred from: code review of 4-3-item-detail-variant-configuration-add-to-cart (2026-05-18)

- `CartBar` `<div>` not keyboard-activatable — `role="complementary"` on a clickable `<div>` is not focusable/activatable via keyboard (Tab/Enter/Space). Must be remedied in story 4-4 when cart review navigation is wired: wrap clickable area in a nested `<button>` or make the landmark contain an explicit interactive element. [components/customer/CartBar.tsx]
- Uncategorized section may show items twice if a DB category has `id: null` — both the category reduce and the `category_id === null` filter would match; categories in Supabase are UUID-keyed so effectively impossible in practice. [components/customer/CustomerMenuClient.tsx]
- Menu item availability computed at SSR time only — items that become unavailable mid-session (e.g., restaurant closes a category) do not update for users already on the menu page. Pre-existing limitation also present in story 4-2. Add periodic availability refresh or Realtime subscription if real-time availability is ever required. [app/[restaurant_slug]/[table_number]/page.tsx]
- `crypto.randomUUID()` unavailable in non-secure (HTTP) contexts — production QR codes always use HTTPS so this is a dev-only concern. If local dev over HTTP is ever needed, add a fallback UUID generator. [components/customer/ItemConfigSheet.tsx]
- Empty variant group (`options: []`) renders group label with no selectable options — data quality edge case; restaurant admin UI should prevent creating empty option lists. Add a guard in the admin variant editor if this becomes an issue. [components/customer/ItemConfigSheet.tsx]

## Deferred from: code review of 4-4-cart-review (2026-05-18)

- `groupCartItems` silently merges items with same `menuItemId`+variants but different `price_cents` — low-probability edge case (price would need to change between add-to-cart and review); displayed total uses the first item's price. Revisit if dynamic pricing or mid-session price changes are introduced. [cart/page.tsx:19-44]
- AC3 (back-navigation preserves cart) has no unit test — Zustand in-memory persistence covers this implicitly for client-side navigation; verification requires an e2e test.
- `groupCartItems` defined at module scope in page file — minor structure concern; move to a shared utility module if needed by other consumers (e.g., order confirmation page in story 4-5).
- Last-item-removed redirect test mutates store after `fireEvent.click` without explicit `act()` wrapper — React Testing Library wraps events internally so tests pass; add explicit `act()` wrapping if flakiness is ever observed.

## Deferred from: code review of 4-5-order-submission-confirmation (2026-05-18)

- `isSubmitting` not reset to `false` on success path — the confirmation screen entirely replaces the cart UI so no stuck button is visible; state resets on navigation (component unmount). Low-risk; consider `setIsSubmitting(false)` on success for defensive cleanliness. [app/[restaurant_slug]/[table_number]/cart/page.tsx]
- Double-submit race window before React commits `disabled` prop — `setIsSubmitting(true)` is scheduled async; two rapid taps could both enter `handlePlaceOrder` before re-render. React 18 automatic batching makes this window effectively zero in practice; a `useRef` guard would eliminate it entirely. [app/[restaurant_slug]/[table_number]/cart/page.tsx]
- `app_metadata` fields destructured without existence check — if `restaurant_id` or `table_number` are absent (misconfigured session), the downstream Supabase query silently returns no rows and the generic error is returned. Add an explicit guard for clearer failure diagnostic. [actions/orderActions.ts]
- `aria-live="assertive"` on static heading is technically non-functional — text already present on first render so the live region never fires. `useEffect` focus management achieves the same screen-reader announcement. Replace with a post-mount text injection pattern if precise SR announcement timing is required. [components/customer/OrderConfirmationScreen.tsx]

## Deferred from: code review of 5-1-real-time-order-feed-with-polling-fallback (2026-05-18)

- INSERT-only Realtime subscription misses UPDATE/DELETE — Story 5.2 wires `markOrderHandled`; expand the channel to `event: '*'` there. [components/shared/RealtimeProvider.tsx]
- No background reconcile poll on happy path — current 4s polling fires only on subscription error; a low-rate (30–60s) safety-net reconcile would catch any silently-dropped Realtime event. Architectural choice for 5.1; revisit when feed becomes business-critical. [components/shared/RealtimeProvider.tsx]
- Page-level auth in `app/admin/orders/page.tsx` duplicates the layout's check — pre-existing pattern across every admin page; consolidate via a shared `getAdminProfile()` helper in a future refactor. [app/admin/orders/page.tsx]
- `formatRelativeTime` is not reactive — cards stuck at "3m ago" until something else re-renders the feed. UX not specified for 5.1; wire a 30–60s tick when 5.2/5.3 introduces session-history views. [components/admin/OrderCard.tsx, utils/formatTime.ts]
- `markHandled` placeholder uses `new Date().toISOString()` client-side — will diverge from server truth. Placeholder pending Story 5.2's `markOrderHandled` Server Action. [stores/orderStore.ts]
- `payload.new` from Realtime and `items: Json` from REST are not runtime-validated — bare `as Order[]` / `as OrderItem[]` casts match the pre-existing project pattern from 2-3, 2-4, 4-3 deferred work. Needs a project-wide zod/shape-validation hardening pass.
- `sortDesc` in `useOrderStore` has unstable tie-break on equal `submitted_at` — identical-millisecond timestamps are extremely rare. Add `id` tie-break if a real-world tie surfaces. [stores/orderStore.ts]
- `formatRelativeTime` does not clamp negative diffs (clock skew) — NTP keeps clocks within seconds in practice. Revisit if clock-skew bugs are reported. [utils/formatTime.ts]
- `OrderFeed` flashes "No orders yet" during initial hydration before `RealtimeProvider` runs — the no-SSR-of-orders choice is intentional per story Dev Notes. Add a `hasHydrated` flag in the store as a polish pass. [components/admin/OrderFeed.tsx]
- `RealtimeProvider` unit test does not assert `setAuth`-before-`subscribe` ordering — this invariant is the load-bearing fix from the e2e iteration. Add a `mock.invocationCallOrder` assertion when patches #1/#2 (auth-state-change listener) are applied. [tests/unit/shared/RealtimeProvider.test.tsx]
- e2e smoke test uses service-role insert — exercises owner-side Realtime delivery end-to-end but bypasses `customer_insert_order` RLS, so the 42501-style bugs that retro action A1 was meant to catch are still only covered by mocks. Drive the customer flow through the UI (or via `createAnonCustomerClient` in `tests/rls/helpers.ts`) in a future story. [tests/e2e/realtime-order-delivery.spec.ts]

## Deferred from: code review of 5-2-order-management-mark-handled-session-history (2026-05-18)

- `handled_at` uses application clock (`new Date().toISOString()`) not DB `now()` — server process clock has negligible drift via NTP; using DB `now()` for true idempotency would need a raw SQL fragment or RPC. Out of 5.2 scope; revisit if cross-server clock skew surfaces in audit reports. [actions/orderActions.ts]
- Tabs ARIA upgrade to full WAI-ARIA tablist pattern — current OrderFeed has half-implemented ARIA (role=tablist + role=tab + aria-selected only). Spec scope honored as-is; future a11y pass to add `role=tabpanel`, `aria-controls`/`id` linkage, and arrow-key (Home/End/Left/Right) navigation handlers. [components/admin/OrderFeed.tsx]

## Deferred from: code review of 6-1-platform-admin-access-tenant-list (2026-05-18)

- No pagination on tenant list — `restaurants.select(...).order(...)` fetches every row without `.limit()`. Acceptable for MVP support tool with low tenant count; revisit once tenant count exceeds ~500 or the payload starts to dominate page weight. [app/platform/tenants/page.tsx]
- No CSRF/auth check pattern for future `/platform` Server Actions — layout `is_platform_admin` guard protects GET render only. Story 6.2 (tenant inspection) and any future platform mutations MUST re-check `is_platform_admin` inside each Server Action; the layout guard does NOT run for server-action endpoints. [app/platform/layout.tsx]
- `toLocaleDateString()` formats differ per browser locale — two operators in different regions see different formats, and unit tests can only weakly assert "year is in there". Future: pin to a fixed format via `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`. [components/platform/TenantList.tsx]
- Filtered count not announced to screen readers — search filter re-renders the list in place with no `aria-live` region. Future a11y polish: wrap a result count in `<div role="status" aria-live="polite">{filtered.length} of {restaurants.length} restaurants</div>`. [components/platform/TenantList.tsx]
- Server Component discards Supabase error from `restaurants` fetch — `const { data } = await supabase.from(...)`; error is silently dropped, page renders "No restaurants registered yet" even when the query failed. Requires error-UX design decision (error boundary vs. inline message vs. retry). [app/platform/tenants/page.tsx]
- `createTestPlatformAdmin` partial-failure leaks an `auth.users` row — if `auth.admin.createUser` succeeds but the subsequent profile `.insert` throws, the auth user is orphaned (variable assignment never happens, afterAll never sees the id). Same shape as `createTestOwner`; needs a project-wide helper hardening pass with try/finally + tracked id list. [tests/rls/helpers.ts]
- Page Server Component admin-client query may execute even when layout would redirect — Next.js App Router parallelizes layout and page render; `createAdminClient()` SELECT runs even if the layout calls `redirect()`. Data never reaches the user (response aborts), but query latency and admin-client log entries occur. Matches existing `app/admin/orders/page.tsx` pattern; project-wide refactor topic. [app/platform/tenants/page.tsx]

## Deferred from: code review of 6-2-tenant-account-inspection-data-access (2026-05-18)

- Server Component discards Supabase error from queries — `if (!restaurant) notFound()` masks a real outage as a 404; tables/items/orders errors coerced silently to `[]`. Same shape as 6.1 deferred item; project-wide error-UX decision. [app/platform/tenants/[restaurant_id]/page.tsx]
- `Promise.all` rejection aborts entire page render — one transient DB/network failure crashes the whole page. `Promise.allSettled` would degrade gracefully but requires a project-wide error-rendering pattern. [app/platform/tenants/[restaurant_id]/page.tsx]
- No support for multi-owner restaurants — schema technically allows multiple `profiles` per `restaurant_id`. The `.maybeSingle()` patch picks one; rendering an owner list is out of MVP scope. Revisit if multi-owner becomes a real feature. [app/platform/tenants/[restaurant_id]/page.tsx]
- No `Suspense` boundary; entire page hangs on slowest query — same pattern as all existing pages (admin/orders, admin/menu). Project-wide streaming refactor topic. [app/platform/tenants/[restaurant_id]/page.tsx]
- `toLocaleDateString()`/`toLocaleTimeString()` are locale/timezone dependent — same as 6.1 deferred item; future fix uses `Intl.DateTimeFormat` with explicit locale + timezone. [app/platform/tenants/[restaurant_id]/page.tsx]
- E2E `beforeAll` failure leaves orphaned data; `afterAll` references possibly-undefined vars — if test resource creation throws partway, cleanup branches reference uninitialized `restaurant`, `restaurantB`, or `adminId`. Same shape as all existing e2e tests; project-wide test harness improvement. [tests/e2e/platform-tenant-inspection.spec.ts]
- Published/Offline badge conveys state via color only; aria-label/contrast not audited — same as 6.1 deferred item; a11y polish to add `aria-label`, icon, or `role="status"`. [app/platform/tenants/[restaurant_id]/page.tsx, components/platform/TenantList.tsx]
- No pagination/total-count for orders; admin can't tell whether the 20-limit truncates — same shape as 6.1's "No pagination on tenant list" deferred item. Add `count: 'exact'` head query + "view all" affordance if order volume per tenant grows. [app/platform/tenants/[restaurant_id]/page.tsx]

## Deferred from: code review of landing-page spec (2026-05-20)

- If the anonymous-JWT customer flow is ever re-introduced (currently prohibited by `_bmad-output/project-context.md`), the landing-page auth gate at `app/page.tsx:22` will need an `is_anonymous` guard — anonymous customer sessions would otherwise be redirected to `/admin` and bounced to onboarding. Today the check `!!data?.claims` is safe because customers are sessionless.
- `text-white` hardcoded on `bg-accent` CTAs across LandingNav/Hero/Pricing/HowItWorks — accent is fixed orange (`#FF6B35`) so contrast is currently safe. Introduce a paired `text-accent-foreground` token if the accent ever becomes theme-dependent.
- Two `ThemeSwitcher` instances on the landing page (nav + footer) — both render identical `aria-label`, producing duplicate control announcements for screen readers. Wrap each in distinct `aria-label` context or place only one. [components/marketing/LandingNav.tsx, components/marketing/LandingFooter.tsx]
- Hero `<br />` inside `<h1>` can cause orphan-word wrapping at viewport widths ~360–420px. Consider `text-balance` (Tailwind 3.4+) or responsive break removal. [components/marketing/LandingHero.tsx]
- Step number `<span>` inside `<ol>` duplicates the implicit list enumeration for screen readers. Mark the visual number `aria-hidden` and let the `<ol>` speak. [components/marketing/LandingHowItWorks.tsx]
- `LandingNav` uses `sticky top-0 z-10` — same z-index as `CategoryTabs` and `MenuPreview` on the customer/admin surfaces. Not a problem today (the marketing nav lives only at `/`), but lock the relative ordering if any shared overlay layer is introduced. [components/marketing/LandingNav.tsx]
- `getClaims()` returning `{ data: null, error }` is treated as unauthenticated (silent fallback). Matches the I/O Matrix but does not distinguish "session expired" from "Supabase outage" — both render the landing. Consider exposing a transient "auth temporarily unavailable" hint if outage frequency becomes a UX concern. [app/page.tsx]
- `tailwind.config.ts` defines `accent: "#FF6B35"` and `error: "#FF3B30"` as raw hex literals (pre-existing) rather than CSS-var-backed tokens like the rest of the design system. Convert to CSS vars on a future theming pass. [tailwind.config.ts]

## Deferred from: code review of story-7.1 (2026-05-20)

- Restaurant-local timezone support for analytics period boundaries — MVP-deferred per Story 7.1 spec Dev Notes. Owners in non-UTC zones see slightly drifted "today" / per-day buckets.
- First-day bucket asymmetry in rolling 7d/30d/90d windows — `periodStart = now − Nd` produces a partial-day first bucket. Acknowledged trade-off ("directionally correct").
- Race between TS-side `periodEnd` (captured at helper entry) and SQL function's execution time — orders submitted mid-RPC fall outside the window. Inherent to instant-now semantics.
- `submitOrder` `getEffectivePrice` semantics with multi-group variants — pre-existing logic returns the first matched group's option price; persisted `unit_price_cents` inherits any inconsistency. Pre-existing, not caused by Story 7.1.
- `submitOrder` `total_cents` overflow risk for very large catering-style carts — column is `integer` (max ~$21.4M). No graceful split-order path.
- Migration backfill `total_cents` from existing orders' `items × unit_price_cents` — skipped; dev/staging orders show $0 revenue per spec acceptance.
- AC #3 performance test (`<1000ms` over 10k rows) is `test.describe.skip`-by-default — spec explicitly authorizes manual-only validation; index half of AC #3 is verifiable. [tests/rls/analytics.spec.ts]
- `cleanupTestRestaurants` doesn't assert that orders were actually deleted — test-helper concern, not Story 7.1's. [tests/rls/helpers.ts]
- Helper does not categorize Supabase error codes (auth `PGRST301` vs schema `PGRST202` vs RLS `42501`) — all collapse into the same emptyState; ops triage friction. [lib/analytics/getRestaurantAnalytics.ts]
- `if (!data)` over-broad in the helper — would emptyState on `0`/`false`/`""` if the SQL function ever returns a JSON scalar. Latent foot-gun, not current bug. [lib/analytics/getRestaurantAnalytics.ts:84]
- No `ANALYZE public.orders` after migration — autovacuum handles planner stats; new composite index may take a beat to be preferred under load.
- Variant label collision: a future restaurant defining an option literally named `"standard"` would merge with the synthetic empty-variant bucket. Unlikely real-world conflict.
- `OrderItem.unit_price_cents` and `Order.total_cents` are typed as required `number` while historical rows have `0`/missing values — acknowledged "forward shape" per spec Dev Notes. Any code reading historical rows needs a runtime guard. [types/app.ts]
- Migration creates `idx_orders_restaurant_submitted_at` without `CONCURRENTLY` — acceptable MVP given small `orders` table. [supabase/migrations/20260520100000_add_orders_total_cents_and_analytics_index.sql]
- Negative `unit_price_cents` not blocked at the action layer — cart is sourced from `menu_items` with CHECK constraints; defense-in-depth gap only. [actions/orderActions.ts]
- No DB-level CHECK invariant `total_cents == sum(items[i].quantity × unit_price_cents)` — defense-in-depth not in spec; can drift on direct service-role insert.
- No explicit `period: '90d'` unit test — coverage gap; `AnalyticsPeriod` union narrows to four periods so the ternary fall-through is type-safe. [tests/unit/lib/analytics/getRestaurantAnalytics.test.ts]
- RLS test doesn't seed historical-shape (no `unit_price_cents`) orders to verify the `coalesce` safety claim from AC #6 — coverage gap. [tests/rls/analytics.spec.ts]
- RLS test doesn't assert `top_items.variants` shape including the `"standard"` fallback — coverage gap. [tests/rls/analytics.spec.ts]
- Performance test uses `Math.random()` for `submitted_at` spread — nondeterministic. Doesn't exercise narrow-window index scans. [tests/rls/analytics.spec.ts:151]
- Test mock `from()` returns `undefined` for unknown tables — brittle to refactors. [tests/unit/actions/orderActions.test.ts:28-49]

## Deferred from: code review of 7-2-order-volume-peak-hours-visualization (2026-05-20)

- Profile-fetch error redirects to `/auth/onboarding` instead of surfacing the DB error — pre-existing, same pattern as `app/admin/orders/page.tsx`. Fix would require auditing all admin page profile-fetch sites. [app/admin/analytics/page.tsx, app/admin/orders/page.tsx]
- Mobile bottom-bar may clip "Analytics" label at 360px width with 7 items (6 tabs + sign out) — story explicitly says do not redesign nav here; flag for a future UI polish story. [components/admin/AdminNav.tsx]

## Deferred from: code review of 7-3-popular-items-revenue-summary (2026-05-20)

- KPI value spans have redundant aria-labels that cause screen readers to double-announce ("Total Revenue. Total Revenue: $50.00"). Spec Task 1 line 67 explicitly mandates the per-value `aria-label="<label>: <value>"`. Flag for spec author review (drop aria-label on the value span OR mark the label span `aria-hidden="true"`). [components/admin/AnalyticsRevenueSummary.tsx:24-46]
- E2E "renders OR empty-state OR error" assertion is tautological — passes as long as any of the three branches appears; new tests add no incremental coverage in the data-positive case. Matches the established 7.2 pattern; revisit project-wide. [tests/e2e/admin-analytics.spec.ts:79-110]
- Variant labels containing `" / "` corrupt the joined breakdown string (e.g. `"salt / pepper"` → `salt / pepper: 7 / standard: 12`, visually unparseable). Spec mandates ` / ` as the separator. Address either by sanitizing variant labels at the data layer or by picking a more robust separator. [components/admin/AnalyticsPopularItemRow.tsx:24]
