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
