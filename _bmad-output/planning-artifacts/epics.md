---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# dine-in-cc - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for dine-in-cc, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Restaurant owner can create a new account via self-serve signup
FR2: Restaurant owner can create a restaurant profile (name, basic details) as part of onboarding
FR3: Restaurant owner can log in and log out of the Admin UI
FR4: Restaurant owner can reset their password
FR5: Restaurant owner can create a menu item with a name, description, tax-inclusive price, and image
FR6: Restaurant owner can define variants for a menu item (e.g., size, modifications, add-ons)
FR7: Restaurant owner can set a price for each variant
FR8: Restaurant owner can configure an availability schedule for a menu item (days and time windows)
FR9: Restaurant owner can organize menu items into named categories
FR10: Restaurant owner can edit any existing menu item's details
FR11: Restaurant owner can delete a menu item
FR12: Restaurant owner can reorder items within a category
FR13: Restaurant owner can preview the menu exactly as customers will see it before publishing
FR14: Restaurant owner can publish a draft menu to make it live for customer ordering
FR15: Restaurant owner can take the menu offline
FR16: Restaurant owner can create a table with a name or number
FR17: System generates a unique QR code URL for each table encoding restaurant and table identity
FR18: Restaurant owner can download or print QR codes for physical table placement
FR19: Restaurant owner can delete a table and invalidate its QR code
FR20: Customer can access a restaurant's live menu by scanning a table QR code without installing an app
FR21: Customer can browse menu items organized by category
FR22: System displays only items within their configured availability schedule at the time of ordering
FR23: Customer can view item details including name, description, price, image, and available variants
FR24: Customer can configure an order item by selecting variants
FR25: Customer can add multiple items to a single order
FR26: Customer can review their full order summary before submitting
FR27: Customer can submit an order without creating an account or providing any personal information
FR28: Customer receives an on-screen order confirmation after successful submission
FR29: Customer can only view and order from the menu of the restaurant linked to their scanned QR code
FR30: Restaurant owner can view all incoming orders in the Admin UI
FR31: Admin UI displays each order's items, variants, table number, and submission timestamp
FR32: Restaurant owner can mark an order as handled
FR33: Restaurant owner can view order history within the current service period
FR34: System delivers a submitted order to the Admin UI within 5 seconds of customer submission
FR35: Admin UI updates automatically when a new order arrives without requiring a page refresh
FR36: Each restaurant's menu, tables, and orders are fully isolated from all other restaurants
FR37: Restaurant owner can only access data belonging to their own restaurant
FR38: Customer ordering session is scoped to the restaurant and table from the scanned QR code
FR39: System issues an anonymous session token to customers on QR scan that expires after the dining session
FR40: Platform admin can view a list of all registered restaurant tenants
FR41: Platform admin can inspect the account and configuration details of any tenant
FR42: Platform admin can access any tenant's data for support purposes

### NonFunctional Requirements

NFR1: Customer QR ordering flow (menu load to order-ready state) completes in under 3 seconds on a mid-range mobile device over typical restaurant WiFi
NFR2: Submitted customer orders appear in the Admin UI within 5 seconds of submission under normal operating conditions
NFR3: Admin UI actions (marking order handled, navigating menu sections) respond within 1 second
NFR4: Menu publish operation completes within 3 seconds regardless of menu size
NFR5: All data in transit is encrypted via HTTPS/TLS — no unencrypted API calls permitted
NFR6: Customer anonymous session tokens are scoped exclusively to the issuing restaurant and table — tokens from one restaurant cannot access another restaurant's data
NFR7: Restaurant owner authentication tokens are invalidated on logout
NFR8: The platform admin role is accessible only to explicitly designated accounts — no privilege escalation path exists for restaurant owner accounts
NFR9: No personally identifiable information is stored or logged for dine-in customers at any point in the order flow
NFR10: All database queries are enforced by Row Level Security policies — application-level access control alone is not sufficient
NFR11: The platform maintains availability during restaurant operating hours — unplanned downtime during an active service period is a P0 incident
NFR12: Order data is persisted durably — a submitted order is not lost due to network interruption or client-side failure after server acknowledgement
NFR13: The customer ordering flow degrades gracefully if Supabase Realtime is unavailable — order submission succeeds even if real-time Admin UI updates temporarily fall back to polling
NFR14: The customer QR ordering flow meets WCAG 2.1 AA standards — usable by customers with visual, motor, or cognitive impairments on any mobile browser
NFR15: The Admin UI meets WCAG 2.1 AA standards as a baseline
NFR16: The system supports at least 50 concurrent customer ordering sessions per restaurant without degradation
NFR17: The multi-tenant data model supports onboarding new restaurants without schema changes or manual intervention
NFR18: Order history is automatically purged after 6 months per tenant — storage growth is bounded without manual maintenance

### Additional Requirements

- **Project initialization (Epic 1 Story 1):** `npx create-next-app -e with-supabase dine-in-cc` followed by `npx getdesign@latest add apple`. Must verify @opennextjs/cloudflare compatibility with Next.js 16 before proceeding.
- **TypeScript strict mode:** Next.js 16 App Router, React 19.2, Turbopack as default dev/build tool.
- **Testing framework:** Vitest + React Testing Library for unit/component tests; Playwright for RLS integration tests (P0 — must pass before any production data).
- **@opennextjs/cloudflare adapter:** Required for Cloudflare Workers deployment. Compatibility with Next.js 16 must be confirmed at project init. Configure `wrangler.toml` and `next.config.ts`.
- **Supabase Auth Hook:** SQL function `custom_access_token_hook` required to inject `app_metadata` (restaurant_id, table_number) into anonymous customer JWTs.
- **RLS test suite (P0):** `tests/rls/` must contain `tenant-isolation.spec.ts`, `anonymous-session.spec.ts`, `platform-admin.spec.ts`. All must pass before any production deploy.
- **pg_cron auto-purge:** 6-month order history purge per tenant (NFR18) implemented as a Supabase pg_cron scheduled job. Post-launch operational task, not MVP blocker.
- **GitHub Actions CI/CD:** Playwright RLS tests run on every PR; `wrangler deploy` on merge to main. Cloudflare API token stored in GitHub Actions secrets.
- **Sentry error monitoring:** Free tier. Wired to both customer flow and Admin UI (`app/layout.tsx` init + `error.tsx` boundaries).
- **Supabase Storage:** Single shared public bucket. Path: `restaurant_id/{item_id}/image`. Storage RLS restricts writes to authenticated restaurant owners scoped to their `restaurant_id`.
- **Anonymous customer session:** 2-hour fixed expiry (no rolling refresh), scoped via JWT `app_metadata` claims (`restaurant_id` + `table_number`). No PII stored.
- **Price storage:** `price_cents: integer` (never floats). Display formatted by `utils/formatPrice.ts`.
- **Server Action return shape:** All Server Actions return `ActionResult<T>` discriminated union `{ success: true; data: T } | { success: false; error: string }` — never throw.
- **Zustand stores:** `cartStore.ts` (customer in-progress order) and `orderStore.ts` (Admin order feed). One store per domain, actions defined inside store.
- **Realtime subscription:** One global subscription at `app/admin/layout.tsx` (Client Component). Polling fallback at 4000ms `setInterval` if Realtime unavailable. Subscription persists across tab navigation.

### UX Design Requirements

UX-DR1: Implement design-md (Apple-inspired) system via `npx getdesign@latest add apple`. Define custom design tokens: primary accent (#FF6B35), status colors (new/in-progress/handled), surface colors for light and dark mode, typography scale (SF Pro Display/Text/Mono roles per the type scale spec).
UX-DR2: Build **MenuItemRow** custom component — 80×80px food photo (left), item name + description (max 2 lines) + price (right). States: default and unavailable (muted + "Not available right now" label). With/without image variants. `role="button"`, `aria-label="{name}, {price}"`, min 44px touch target.
UX-DR3: Build **ItemConfigSheet** custom component — bottom sheet with handle + food photo (16:9 full-width) + name/price + description + variant selectors + "Add to Order" CTA. States: default, variant selected, add pending. `role="dialog"`, `aria-modal="true"`, focus trap while open, Escape closes. Focus moves to sheet heading on open; returns to triggering MenuItemRow on dismiss.
UX-DR4: Build **CartBar** custom component — persistent fixed-bottom bar. Anatomy: item count pill (left) + "Review Order" label (centre) + total price (right). States: hidden (0 items), active (≥1 item), submitting. Respects iOS safe area inset. `role="complementary"`, `aria-label="Cart: {count} items, {total}"`, `aria-live="polite"` on count change.
UX-DR5: Build **OrderConfirmationScreen** custom component — full-screen closed-loop success state. Anatomy: green check icon + headline ("Your order is with the kitchen") + subtext + divider + order summary (no prices) + restaurant/table tag. `role="main"`, `aria-live="assertive"` on headline, focus moves to headline on mount. Errors route back to order review with retry — never shown here.
UX-DR6: Build **OrderCard** custom component (Admin) — compact row. Anatomy: 8px status dot + table number (bold, `title-3` size) + item summary (first 2 items + "+N more") + relative/absolute timestamp + "Mark handled" text link. States: active (orange dot, full opacity), handled (grey dot, 40% opacity, no action). Row tap expands inline to full item list. Mobile (full-width row) and desktop (left panel list item) variants. `role="article"`, `aria-label="Order for Table {n}, {items}, {time}"`.
UX-DR7: Build **OrderDetailPanel** custom component (Admin desktop only) — full order detail right panel. Anatomy: large table number + timestamp + full item list (name + variants) + "Mark Handled" button. States: empty (no order selected), active, handled (button muted). `role="region"`, `aria-label="Order detail"`, `aria-live="polite"` on content area.
UX-DR8: Build **OnboardingChecklist** custom component — contextual setup guide in Admin dashboard until all steps complete. Anatomy: progress indicator + step list (icon + label + status) + CTA per incomplete step. States: incomplete, complete (checkmark, muted), all-complete (auto-hides). Steps: Add menu items → Preview → Publish → Create tables → Print QR codes.
UX-DR9: Customer menu implements design direction D1 (Classic Apple) — image-led rows, horizontal category tab bar (active state: `border-bottom: 2px solid #FF6B35`), 80×80px photos `border-radius: 12px`, `surface-base` (#FFFFFF) light mode background, cinematic food photo treatment.
UX-DR10: Admin order feed implements direction B (Compact List) — `surface-base` (#000000) dark mode background, Active/Handled/All tab bar at top, inline row expansion (no full-screen navigation), "Mark handled" as text link (no button chrome), 8px status dot (orange=active, grey=handled).
UX-DR11: Admin UI desktop layout — 2-column split at `lg` breakpoint (1024px+): 240px left sidebar order list + right main panel for order detail. Left sidebar navigation (3 sections: Orders · Menu · Settings) replaces bottom tab bar at `lg`+. Menu builder gains wider form layout on desktop.
UX-DR12: Skeleton loading screens — match real content layout exactly. Customer menu skeleton: category tab placeholders + 3 item row placeholders with grey image boxes. Admin feed skeleton: 3 compact row placeholders with dot + text lines. No generic spinners anywhere.
UX-DR13: Empty state patterns — every empty state has a contextual CTA. Empty menu builder: "Add your first item →". Empty order feed Active tab: "No orders yet — orders will appear here automatically". Empty table list: "Create your first table →". Copy is direct and non-apologetic.
UX-DR14: Accessibility implementation — focus management for ItemConfigSheet (focus to heading on open, return to triggering row on dismiss); skip link `<a href="#main-content">` as first focusable element in Admin UI desktop; error messages with `role="alert"`; CartBar count with `aria-live="polite"`; Admin feed new order arrival with `aria-live="polite"`; full keyboard navigation in all Admin UI flows; axe-core automated accessibility checks in CI (blocks deploy on WCAG AA violations).
UX-DR15: Admin UI mobile navigation — bottom tab bar with 3 tabs (Orders · Menu · Settings), Orders as default tab during service, portrait-first order card layout, all actions in thumb zone (min 44×44px tap targets), `padding-bottom: env(safe-area-inset-bottom)` for CartBar and bottom tab bar.
UX-DR16: Form patterns across Admin UI — label always above field (never placeholder-as-label), validation on blur (not on keystroke), auto-save drafts in menu builder (debounced 2s after last keystroke), numeric keyboard for price inputs (`inputmode="decimal"`), image upload with drag-and-drop (desktop) / tap-to-select (mobile), preview shown immediately after selection.
UX-DR17: No toast notifications — all feedback is persistent. New order arrival signal is the appearing OrderCard row only (no badge accumulation, no toast). Confirmation dialogs only for destructive actions (delete item, remove table, take menu offline). All other actions are single-tap, no dialog.
UX-DR18: Responsive implementation — Tailwind `sm:` and `lg:` prefixes only (no `md:` layout breakpoint for MVP), mobile-first. All images use `loading="lazy"` with explicit `width` and `height` to prevent layout shift. Tailwind spacing scale in `rem` — no fixed `px` for layout dimensions.

### FR Coverage Map

FR1: Epic 1 — Restaurant owner self-serve signup
FR2: Epic 1 — Restaurant profile creation during onboarding
FR3: Epic 1 — Login/logout Admin UI
FR4: Epic 1 — Password reset
FR5: Epic 2 — Create menu item (name, description, price, image)
FR6: Epic 2 — Define item variants
FR7: Epic 2 — Set variant prices
FR8: Epic 2 — Configure item availability schedule
FR9: Epic 2 — Organize items into named categories
FR10: Epic 2 — Edit existing menu item
FR11: Epic 2 — Delete menu item
FR12: Epic 2 — Reorder items within a category
FR13: Epic 2 — Preview menu before publishing
FR14: Epic 2 — Publish draft menu
FR15: Epic 2 — Take menu offline
FR16: Epic 3 — Create a table
FR17: Epic 3 — System generates unique QR code URL per table
FR18: Epic 3 — Download/print QR codes
FR19: Epic 3 — Delete table and invalidate QR code
FR20: Epic 4 — Customer accesses live menu via QR scan
FR21: Epic 4 — Browse menu by category
FR22: Epic 4 — Availability filter applied at browse time
FR23: Epic 4 — View item details (name, description, price, image, variants)
FR24: Epic 4 — Configure item by selecting variants
FR25: Epic 4 — Add multiple items to order
FR26: Epic 4 — Review full order summary before submitting
FR27: Epic 4 — Submit order anonymously
FR28: Epic 4 — On-screen confirmation after submission
FR29: Epic 4 — Customer scoped to restaurant from scanned QR
FR30: Epic 5 — View incoming orders in Admin UI
FR31: Epic 5 — Order displays items, variants, table number, timestamp
FR32: Epic 5 — Mark order as handled
FR33: Epic 5 — View order history within service period
FR34: Epic 5 — Order delivered to Admin UI within 5 seconds
FR35: Epic 5 — Admin UI auto-updates on new order (no refresh)
FR36: Epic 1 — Restaurant data fully isolated via RLS
FR37: Epic 1 — Owner only accesses own restaurant data
FR38: Epic 1 — Customer session scoped to restaurant + table from QR
FR39: Epic 1 — Anonymous session token issued on QR scan, 2-hour expiry
FR40: Epic 6 — Platform admin views all tenant restaurants
FR41: Epic 6 — Platform admin inspects tenant account/config
FR42: Epic 6 — Platform admin accesses tenant data for support

## Epic List

### Epic 1: Project Foundation & Restaurant Authentication
Restaurant owners can sign up, create their restaurant profile, and log in to a secure Admin UI. This epic also establishes the full database schema, multi-tenant RLS policies (with P0 test suite), CI/CD pipeline, and infrastructure that every subsequent epic depends on.
**FRs covered:** FR1, FR2, FR3, FR4, FR36, FR37, FR38, FR39

### Epic 2: Menu Building & Publishing
Restaurant owners can build their complete menu — categories, items with variants, images, and availability schedules — preview it exactly as customers will see it, publish it live, and take it offline.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15

### Epic 3: Table Management & QR Code Generation
Restaurant owners can create and manage tables, generate unique QR codes per table, and download or print them for physical placement.
**FRs covered:** FR16, FR17, FR18, FR19

### Epic 4: Customer Ordering Flow
Dine-in customers can scan a table QR code, browse the live menu by category, configure items and variants, submit an order anonymously without an account, and receive immediate, unambiguous confirmation.
**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29

### Epic 5: Real-Time Order Management
Restaurant owners receive submitted orders instantly in the Admin UI during live service — no refresh required — view full order details, mark orders as handled, and review order history throughout the service period.
**FRs covered:** FR30, FR31, FR32, FR33, FR34, FR35

### Epic 6: Platform Administration
The platform admin can view all registered tenant restaurants, inspect any account's configuration, and access tenant data to resolve support issues.
**FRs covered:** FR40, FR41, FR42

---

## Epic 1: Project Foundation & Restaurant Authentication

Restaurant owners can sign up, create their restaurant profile, and log in to a secure Admin UI. This epic also establishes the full database schema, multi-tenant RLS policies (with P0 test suite), CI/CD pipeline, and infrastructure that every subsequent epic depends on.

### Story 1.1: Project Initialization & Infrastructure Setup

As a developer,
I want the project scaffolded using the official Supabase Next.js starter with the Cloudflare Workers adapter and design-md system installed,
So that all subsequent development has a consistent, verified foundation with CI/CD and error monitoring ready.

**Acceptance Criteria:**

**Given** the developer runs `npx create-next-app -e with-supabase dine-in-cc`
**When** the command completes
**Then** a Next.js 16 App Router project exists with TypeScript strict mode, Tailwind CSS, and Supabase SSR utilities in `utils/supabase/`
**And** `@opennextjs/cloudflare` compatibility with Next.js 16 is verified — if incompatible, Next.js is downgraded to the latest supported version and documented

**Given** the project is initialized
**When** `npx getdesign@latest add apple` is run
**Then** the design-md Apple system is installed and custom design tokens (accent `#FF6B35`, surface colors light/dark, typography scale) are defined in `tailwind.config.ts`

**Given** `wrangler.toml` and `next.config.ts` are configured with `@opennextjs/cloudflare`
**When** `next build` is run
**Then** the output is compatible with Cloudflare Workers and `wrangler dev` runs without errors

**Given** Sentry free tier is configured
**When** a runtime error occurs on either the customer flow or Admin UI
**Then** Sentry captures it via the init in `app/layout.tsx` and `error.tsx` boundaries

**Given** GitHub Actions is configured
**When** a PR is opened
**Then** the CI workflow in `.github/workflows/ci.yml` runs Playwright tests automatically

**Given** the CI workflow is configured
**When** a merge to `main` occurs
**Then** `wrangler deploy` deploys to Cloudflare Workers using the API token stored as a GitHub Actions secret

**Given** environment setup is complete
**When** the repo is cloned fresh
**Then** `.env.example` documents all required variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`) and `.env.local` is excluded from git

---

### Story 1.2: Database Schema, RLS Policies & Security Foundation

As a developer,
I want the complete Supabase database schema in place with RLS policies enforced and a passing P0 test suite,
So that multi-tenant data isolation is guaranteed before any real data is written and verified on every PR.

**Acceptance Criteria:**

**Given** the Supabase project is configured
**When** the schema migration is applied
**Then** the following tables exist with correct `snake_case` naming: `restaurants` (id uuid PK, slug unique, name, is_published bool, created_at), `profiles` (id uuid FK→auth.users, restaurant_id FK, is_platform_admin bool default false), `categories` (id, restaurant_id, name, display_order), `menu_items` (id, restaurant_id, category_id, name, description, price_cents integer, is_published bool, created_at), `tables` (id, restaurant_id, number integer, created_at), `orders` (id, restaurant_id, table_id, items jsonb, submitted_at, is_handled bool, handled_at)
**And** all price fields use `price_cents: integer` — no float columns exist

**Given** the schema is applied
**When** an authenticated restaurant owner queries any table
**Then** RLS policies return only rows where `restaurant_id` matches their JWT's restaurant claim
**And** a query by owner A returns empty results for owner B's data

**Given** the schema is applied
**When** an anonymous customer JWT with `app_metadata.restaurant_id` and `app_metadata.table_number` is present
**Then** the anonymous session can INSERT into `orders` only for their own restaurant and table number
**And** the anonymous session can SELECT from `menu_items` only for their own restaurant (published items only)
**And** the anonymous session cannot read or write any other restaurant's data

**Given** the Supabase Auth Hook `custom_access_token_hook` is installed
**When** an anonymous user is created with `app_metadata: { restaurant_id, table_number }`
**Then** the issued JWT contains those custom claims accessible via `auth.jwt() -> 'app_metadata'`

**Given** the schema and RLS are in place
**When** the Playwright P0 test suite in `tests/rls/` runs against local Supabase
**Then** `tenant-isolation.spec.ts` passes — cross-tenant reads return empty sets for two fixture tenants
**And** `anonymous-session.spec.ts` passes — anonymous tokens are correctly scoped to their restaurant and table
**And** `platform-admin.spec.ts` passes — platform admin can read all tenants; owner accounts cannot escalate to admin
**And** all three files must pass before any production deployment

---

### Story 1.3: Restaurant Owner Signup & Restaurant Profile Creation

As a restaurant owner,
I want to create an account with my email and set up my restaurant profile (name and unique slug) through self-serve signup,
So that I can access the Admin UI and begin configuring my restaurant without contacting support.

**Acceptance Criteria:**

**Given** a prospective owner visits `/signup`
**When** they enter a valid email and password and submit
**Then** a Supabase Auth account is created and a `profiles` row is inserted with `is_platform_admin: false`
**And** they are prompted to enter their restaurant name and choose a URL slug

**Given** an owner enters a restaurant slug
**When** they move focus away from the slug field
**Then** client-side validation checks the slug against `^[a-z0-9-]{3,50}$` and shows an inline error below the field if invalid

**Given** an owner submits a slug that is already taken
**When** the server-side uniqueness check runs
**Then** an inline error ("This URL is already in use — try another") is shown without clearing the name or other fields

**Given** valid signup data with a unique slug
**When** the form is submitted
**Then** a `restaurants` row is inserted linked to the owner's `profiles.restaurant_id`
**And** the owner is redirected to `/admin` with the Admin UI dashboard visible
**And** the OnboardingChecklist is rendered on the dashboard with all steps in incomplete state

**Given** a signed-up owner navigates to any `/admin` route
**When** their Supabase queries execute
**Then** RLS returns only their own restaurant's data — no other tenant's data is accessible

---

### Story 1.4: Admin UI Authentication — Login, Logout & Password Reset

As a restaurant owner,
I want to log in to and out of the Admin UI and reset my password if needed,
So that I have secure, persistent access to my management panel from any device.

**Acceptance Criteria:**

**Given** a registered owner visits `/login`
**When** they enter their email and password and submit
**Then** they are authenticated via Supabase Auth and redirected to `/admin`
**And** the session is stored as an SSR cookie via `supabase-ssr` (not localStorage)

**Given** an authenticated owner triggers logout
**When** the logout Server Action runs
**Then** the Supabase session is invalidated server-side and the auth cookie is cleared
**And** the owner is redirected to `/login` and cannot access any `/admin` route without re-authenticating

**Given** an unauthenticated user attempts to access any route under `/admin`
**When** the middleware runs
**Then** they are redirected to `/login` with no admin content visible

**Given** an owner visits `/reset-password` and enters their email
**When** they submit the form
**Then** a Supabase password reset email is sent
**And** following the reset link allows them to set a new password and sign back in

**Given** an owner enters incorrect credentials on `/login`
**When** authentication fails
**Then** an inline error ("Incorrect email or password — tap to try again") is shown without clearing the email field

---

### Story 1.5: Restaurant Settings — View & Edit Profile

As a restaurant owner,
I want to view my restaurant name and URL slug in the Admin Settings page and update my restaurant name if needed,
So that I can correct onboarding mistakes and always know my customer-facing URL.

**Acceptance Criteria:**

**Given** an authenticated owner navigates to `/admin/settings`
**When** the page renders
**Then** the current restaurant name is shown in an editable text field
**And** the URL slug is shown as read-only, prefixed as `dine-in/{slug}`
**And** a note explains that the slug cannot be changed after setup

**Given** an owner edits their restaurant name and clicks "Save"
**When** `updateRestaurantName()` completes
**Then** `restaurants.name` is updated for their restaurant
**And** an inline success message is shown

**Given** an owner submits an empty restaurant name
**When** the form validates
**Then** an inline error is shown and no DB update is made

**Given** an authenticated owner is on any admin page
**When** the Admin navigation renders
**Then** a "Settings" tab is present and navigates to `/admin/settings` with active-state highlighting

---

## Epic 2: Menu Building & Publishing

Restaurant owners can build their complete menu — categories, items with variants, images, and availability schedules — preview it exactly as customers will see it, publish it live, and take it offline.

### Story 2.1: Category Management

As a restaurant owner,
I want to create and manage named categories for my menu,
So that my menu items are organized into sections customers can navigate easily.

**Acceptance Criteria:**

**Given** an authenticated owner is on `/admin/menu`
**When** they create a new category with a name
**Then** the category is persisted to the `categories` table scoped to their `restaurant_id`
**And** it appears immediately in the menu builder

**Given** an owner has one or more categories
**When** they rename a category
**Then** the update is saved and reflected immediately in the builder

**Given** an owner deletes a category that still has items
**When** they confirm the destructive dialog
**Then** the category and all its items are deleted

**Given** no categories exist
**When** the menu page renders
**Then** an empty state with "Add your first category →" is shown

---

### Story 2.2: Menu Item Creation, Edit & Delete

As a restaurant owner,
I want to create, edit, and delete menu items with name, description, price, and image,
So that my menu reflects my actual offerings with all the detail customers need.

**Acceptance Criteria:**

**Given** an owner opens the new item form at `/admin/menu/new`
**When** the page renders
**Then** they see fields for: name (required), description, price (currency-prefixed numeric input), image upload, and a category selector showing their existing categories

**Given** an owner fills in item fields and stops typing for 2 seconds
**When** the auto-save debounce fires
**Then** the item is saved/updated via `menuActions.ts` and a silent indicator confirms success

**Given** an owner selects an image (drag-and-drop desktop / tap-to-select mobile)
**When** an image is selected
**Then** a preview is shown immediately before upload
**And** on save the image is uploaded to Supabase Storage at `{restaurant_id}/{item_id}/image` via Server Action and served via CDN

**Given** an owner enters a price
**When** saved
**Then** it is stored as `price_cents: integer` and displayed as a formatted currency string via `utils/formatPrice.ts`

**Given** an owner triggers item delete
**When** the destructive confirmation dialog is confirmed
**Then** the item is removed from `menu_items` and no longer appears in the builder or customer view

**Given** a Server Action fails during save
**When** the error is returned
**Then** an inline error ("Unable to save — tap to try again") is shown and form data is preserved

**Given** an owner navigates to an existing item at `/admin/menu/[item_id]`
**When** the item form renders
**Then** all existing field values (name, description, price, image, category, variants, availability) are pre-populated and the auto-save mechanism applies to any changes (FR10)

---

### Story 2.3: Item Variants & Pricing

As a restaurant owner,
I want to define variants for a menu item and set a price per variant,
So that customers can configure items (e.g., size, modifications) and see accurate prices.

**Acceptance Criteria:**

**Given** an owner is editing a menu item
**When** they add a variant group (e.g., "Size") via the VariantEditor
**Then** the group is saved and they can add up to 6 options (e.g., "Small," "Large")

**Given** an owner enters a price per variant option
**When** saved
**Then** each price is stored as `price_cents: integer`

**Given** an owner removes a variant option
**When** the change is auto-saved
**Then** the option no longer appears in the builder or the customer menu

---

### Story 2.4: Item Availability Scheduling

As a restaurant owner,
I want to configure day and time window availability for a menu item,
So that items like lunch specials only appear on the customer menu during the correct hours.

**Acceptance Criteria:**

**Given** an owner is editing a menu item
**When** they open the availability section
**Then** the AvailabilitySchedule component shows a day-of-week selector (Mon–Sun) and a start/end time picker

**Given** an owner saves an availability schedule
**When** it is persisted
**Then** the schedule is stored in `menu_items` and the item is only visible on the customer menu during those days and times

**Given** no availability schedule is set
**When** a customer views the menu
**Then** the item is treated as available at all times

**Given** a customer views the menu outside a configured schedule window
**When** the menu renders
**Then** the item is displayed in the MenuItemRow unavailable state ("Not available right now") — visible but not orderable

---

### Story 2.5: Item Reordering within Category

As a restaurant owner,
I want to reorder menu items within a category,
So that I control the sequence in which items appear to customers.

**Acceptance Criteria:**

**Given** an owner drags an item to a new position within its category
**When** the reorder is saved
**Then** `display_order` values are updated for all affected items and the new order is reflected immediately in the builder

**Given** items have been reordered
**When** a customer views the menu
**Then** items appear in the owner-defined order within each category

**Given** the Server Action returns an error on reorder
**When** the error is caught
**Then** an inline error is shown and items snap back to their previous order

---

### Story 2.6: Menu Preview

As a restaurant owner,
I want to preview my menu exactly as customers will see it,
So that I can verify content and layout before publishing.

**Acceptance Criteria:**

**Given** an owner navigates to the menu preview
**When** the MenuPreview component renders
**Then** it displays the menu using the same D1 layout, category tabs, item rows, and styling as the customer-facing menu — photos, names, descriptions, prices, and variants are identical

**Given** the menu contains items with availability schedules
**When** the preview renders
**Then** unavailable items (based on current time) show the unavailable state

**Given** the owner is in preview mode
**When** they view the preview
**Then** no Admin UI controls (edit, delete, reorder) are visible — read-only customer view only

**Given** an owner is on the menu builder page (`/admin/menu`)
**When** the page renders
**Then** a "Preview menu →" link is visible in the page header at all times
**And** clicking it navigates to `/admin/menu/preview`

---

### Story 2.7: Menu Publish, Offline Control & Onboarding Checklist

As a restaurant owner,
I want to publish my menu so customers can order from it and take it offline when needed,
So that I control when my menu is live and am guided through the final setup steps after publishing.

**Acceptance Criteria:**

**Given** an owner triggers "Publish"
**When** `publishMenu()` completes within 3 seconds (NFR4)
**Then** `restaurants.is_published` is set to `true` and the menu is live to QR-scanning customers

**Given** the menu is successfully published
**When** the success state renders
**Then** the message "Your menu is live. Print your QR codes and place them on tables." is shown with a direct link to the Tables section

**Given** an owner triggers "Take offline" and confirms the dialog
**When** the action completes
**Then** `restaurants.is_published` is set to `false` and customers scanning the QR code see the "Menu unavailable" state

**Given** the owner completes menu setup steps
**When** the OnboardingChecklist evaluates state
**Then** "Add menu items" is marked complete when at least one item exists
**And** "Preview" is marked complete after the owner visits the preview
**And** "Publish" is marked complete when `is_published` is `true`

**Given** an owner is on any admin page (`/admin`, `/admin/menu`, `/admin/tables`)
**When** the page renders
**Then** a persistent navigation element is visible — bottom tab bar on mobile, left sidebar on desktop
**And** tabs for Dashboard, Menu, and Tables are present with active-state highlighting on the current section
**And** clicking Dashboard navigates to `/admin`, Menu to `/admin/menu`, Tables to `/admin/tables`

---

## Epic 3: Table Management & QR Code Generation

Restaurant owners can create and manage tables, generate unique QR codes per table, and download or print them for physical placement.

### Story 3.1: Table Creation, QR Code Generation & Download

As a restaurant owner,
I want to create tables, have unique QR codes generated automatically for each one, and download or print them,
So that customers at each table can scan their code and access my restaurant's menu.

**Acceptance Criteria:**

**Given** an authenticated owner is on `/admin/tables`
**When** they create a table with a number (e.g., "5")
**Then** a row is inserted in `tables` with `restaurant_id` and `number: integer`
**And** the table appears immediately in the list via the TableCard component

**Given** a table is created
**When** the system generates the QR code via `utils/generateQrUrl.ts`
**Then** the QR URL is `https://app.dine-in-cc.com/{restaurant_slug}/{table_number}`
**And** the QR code is rendered immediately via the QrCodeDisplay component

**Given** a QR code is rendered
**When** the owner taps "Download" or "Print"
**Then** the QR code is downloadable as an image or printable directly from the browser

**Given** the owner creates their first table and downloads a QR code
**When** the OnboardingChecklist evaluates state
**Then** "Create tables" is marked complete when at least one table exists
**And** "Print QR codes" is marked complete after the first download or print action

**Given** no tables exist
**When** the tables page renders
**Then** an empty state with "Create your first table →" is shown

---

### Story 3.2: Table Deletion & QR Code Invalidation

As a restaurant owner,
I want to delete a table and its QR code,
So that decommissioned tables can no longer be used to place orders.

**Acceptance Criteria:**

**Given** an owner triggers delete on a table
**When** the confirmation dialog is confirmed
**Then** the `tables` row is deleted via `tableActions.ts`

**Given** a table is deleted
**When** a customer scans the now-invalidated QR code URL
**Then** they see the "Menu unavailable" error state — the route resolves but returns no valid table

**Given** the Server Action for delete fails
**When** the error is returned
**Then** an inline error is shown and the table remains in the list

---

## Epic 4: Customer Ordering Flow

Dine-in customers can scan a table QR code, browse the live menu by category, configure items and variants, submit an order anonymously without an account, and receive immediate, unambiguous confirmation.

### Story 4.1: QR Scan, Anonymous Session & Menu Load

As a dine-in customer,
I want to scan the QR code on my table and immediately see the restaurant's live menu in my mobile browser,
So that I can begin browsing without downloading an app or creating an account.

**Acceptance Criteria:**

**Given** a customer scans the QR code at their table
**When** the browser opens `/{restaurant_slug}/{table_number}`
**Then** the server-side middleware issues an anonymous Supabase session with `app_metadata: { restaurant_id, table_number }` — no login prompt is shown
**And** the token expires after 2 hours with no rolling refresh

**Given** the anonymous session is issued
**When** the page renders via SSR
**Then** the restaurant's published menu is fetched server-side and rendered — the customer sees category tabs and items immediately, no splash screen or onboarding prompt
**And** the flow completes within 3 seconds on a mid-range mobile device over restaurant WiFi (NFR1)

**Given** the page is loading
**When** the network is slow
**Then** the MenuSkeleton (category tab placeholders + 3 item row placeholders with grey image boxes) is shown and replaced with real content on completion — no layout shift

**Given** the restaurant's menu is offline or the slug/table number doesn't resolve to a valid record
**When** the page renders
**Then** the error state shows "This menu isn't available right now. Please ask your server." with no retry button

**Given** the anonymous session token is used
**When** it queries any table
**Then** it can only read published `menu_items` for the specific restaurant — cross-tenant access returns empty (RLS enforced, FR29)

---

### Story 4.2: Menu Browsing by Category with Availability Filtering

As a dine-in customer,
I want to browse the menu by category and see only items available right now,
So that I can quickly find what I want without confusion about what I can actually order.

**Acceptance Criteria:**

**Given** the menu has loaded
**When** the CategoryTabs render at the top of the page
**Then** each category appears as a tab; tapping a tab scrolls to or displays that category's items
**And** the active tab has `border-bottom: 2px solid #FF6B35` (D1 design direction)

**Given** a category is displayed
**When** items render
**Then** each available item is a MenuItemRow: 80×80px photo, name, description (max 2 lines), right-aligned price
**And** items with no image show a placeholder gracefully

**Given** an item has an availability schedule
**When** the menu renders outside the scheduled window
**Then** the item appears in the MenuItemRow unavailable variant ("Not available right now") and is not tappable (FR22)

**Given** all items in a category are currently unavailable
**When** the category renders
**Then** the category tab and its items still appear — the category is not hidden entirely

---

### Story 4.3: Item Detail, Variant Configuration & Add to Cart

As a dine-in customer,
I want to tap a menu item, see its full details and variants in a bottom sheet, and add it to my order,
So that I can configure exactly what I want before committing.

**Acceptance Criteria:**

**Given** a customer taps an available MenuItemRow
**When** the tap registers
**Then** the ItemConfigSheet slides up as a bottom sheet containing: drag handle, food photo (16:9 full-width), item name + price, description, variant selectors (if applicable), and "Add to Order" CTA
**And** focus moves to the sheet heading and a focus trap is active while the sheet is open

**Given** an item has variants
**When** the sheet renders
**Then** each variant group and its options (up to 6) are shown as selectable — selecting an option highlights it and updates the displayed price if the variant has a different price

**Given** a customer taps "Add to Order"
**When** the item (with selected variants) is added to `cartStore`
**Then** the ItemConfigSheet dismisses and the CartBar appears at the bottom showing updated item count and total
**And** focus returns to the triggering MenuItemRow
**And** each "Add to Order" tap adds exactly one unit of the item — there is no quantity stepper; adding the same item again creates a second line entry in the cart

**Given** an item has no variants
**When** the sheet renders
**Then** no variant section is shown — the sheet shows only item details and the CTA

**Given** the customer dismisses the sheet via handle drag or tap-outside
**When** the sheet closes
**Then** no item is added to the cart

---

### Story 4.4: Cart Review

As a dine-in customer,
I want to review my full order summary before submitting,
So that I can confirm everything is correct before it goes to the kitchen.

**Acceptance Criteria:**

**Given** the customer has at least one item in the cart
**When** the CartBar is visible
**Then** it shows item count pill (left), "Review Order" label (centre), and total price (right), fixed to the bottom of the screen with iOS safe area inset respected
**And** `aria-live="polite"` announces count changes to screen readers

**Given** the customer taps the CartBar
**When** the order review screen renders
**Then** each cart item is shown with name, selected variants, quantity, and line total
**And** the grand total is shown at the bottom
**And** a single full-width "Place Order" CTA is the only action — no secondary actions

**Given** the customer navigates back from the review screen
**When** they return to the menu
**Then** the CartBar still shows their current cart — no items are lost

**Given** the cart has 0 items
**When** the menu renders
**Then** the CartBar is hidden entirely

**Given** the customer is on the order review screen
**When** they tap the remove action on a cart line item
**Then** the item is removed from `cartStore` and the order summary and grand total update immediately without a page reload

**Given** the customer removes the last item from the cart on the review screen
**When** the cart becomes empty
**Then** the customer is returned to the menu and the CartBar is hidden

---

### Story 4.5: Order Submission & Confirmation

As a dine-in customer,
I want to submit my order with a single tap and receive immediate confirmation,
So that I know my order has reached the kitchen without needing to speak to staff.

**Acceptance Criteria:**

**Given** the customer taps "Place Order"
**When** `submitOrder()` Server Action is called
**Then** the UI waits for the Supabase INSERT acknowledgement before transitioning (pessimistic submission, NFR12)
**And** the "Place Order" button shows a loading state during the wait

**Given** the INSERT succeeds
**When** the server acknowledges
**Then** the OrderConfirmationScreen renders full-screen: green check icon, headline "Your order is with the kitchen", order summary (items only, no prices), restaurant + table tag
**And** `aria-live="assertive"` on the headline announces confirmation and focus moves to the headline on mount

**Given** the confirmation screen is shown
**When** the customer views it
**Then** no rating prompts, account nudges, or next-step actions are shown — it is a closed loop

**Given** the INSERT fails
**When** the error is returned
**Then** the customer stays on the review screen with inline error: "Tap to try again — your order hasn't been sent"
**And** the full cart is preserved — no items are lost on failure

**Given** an order is persisted
**When** the record is written
**Then** it contains `restaurant_id`, `table_id`, `items` (jsonb with names, variants, quantities), `submitted_at`, `is_handled: false`
**And** no customer PII is stored anywhere in the record (NFR9)

---

## Epic 5: Real-Time Order Management

Restaurant owners receive submitted orders instantly in the Admin UI during live service — no refresh required — view full order details, mark orders as handled, and review order history throughout the service period.

### Story 5.1: Real-Time Order Feed with Polling Fallback

As a restaurant owner,
I want new customer orders to appear in my Admin UI automatically during service without any page refresh,
So that I never miss an order and can manage the service floor without paper tickets.

**Acceptance Criteria:**

**Given** an authenticated owner has `/admin/orders` open
**When** a customer submits an order
**Then** the OrderCard appears at the top of the Active tab within 5 seconds — no refresh required (FR34, FR35, NFR2)

**Given** the Admin UI layout mounts at `app/admin/layout.tsx`
**When** the Client Component renders
**Then** a single global Supabase Realtime subscription is established for `orders` filtered by `restaurant_id=eq.{restaurantId}`
**And** new INSERT events call `useOrderStore.getState().addOrder()` — direct store access, not a hook, to work inside the Realtime callback

**Given** Supabase Realtime is unavailable
**When** the subscription fails or drops
**Then** a `setInterval` polling fallback at 4000ms activates silently — no user-visible error or indicator
**And** the interval is cleared when Realtime reconnects (NFR13)

**Given** the order feed renders on mobile
**When** the Active tab displays
**Then** orders appear as compact OrderCard rows: 8px orange status dot, bold table number, item summary (first 2 items + "+N more"), relative timestamp (relative up to 60 min, then absolute) — dark mode `#000000` background (Direction B)

**Given** the Active tab has no unhandled orders
**When** it renders
**Then** the empty state shows "No orders yet — orders will appear here automatically" — no refresh prompt

**Given** the feed first loads
**When** the skeleton displays
**Then** 3 compact row placeholders with dot + text lines appear and are replaced without layout shift

---

### Story 5.2: Order Management — Mark Handled & Session History

As a restaurant owner,
I want to mark orders as handled and review what's been fulfilled during a service,
So that I can manage the queue and track order completion throughout the session.

**Acceptance Criteria:**

**Given** an order is in the Active tab
**When** the owner taps "Mark handled" on the OrderCard
**Then** `markOrderHandled()` Server Action sets `is_handled: true` on the order
**And** the OrderCard immediately transitions to handled state (grey dot, 40% opacity) — no confirmation dialog, single tap

**Given** an order is marked handled
**When** the feed updates
**Then** the order moves to the Handled tab and the next unhandled order surfaces at the top of Active

**Given** the owner taps a compact OrderCard row to expand it
**When** the row expands inline
**Then** the full item list (name + variants for every item) is shown without navigating away from the feed

**Given** the owner selects the Handled tab
**When** it renders
**Then** all orders marked handled during the session are shown with grey dot and muted styling (FR33)

**Given** the owner selects the All tab
**When** it renders
**Then** all orders (active + handled) are shown together, newest first

---

### Story 5.3: Desktop 2-Column Order Layout & Detail Panel

As a restaurant owner,
I want a dedicated order detail panel when using the Admin UI on desktop,
So that I can manage the full service comfortably from behind the counter with more screen space.

**Acceptance Criteria:**

**Given** the Admin UI is accessed on a screen ≥1024px
**When** the orders page renders
**Then** the layout is 2-column: 240px left sidebar with the compact order list + right main panel with OrderDetailPanel
**And** the bottom tab bar is replaced by a left sidebar with 3 sections: Orders · Menu · Settings

**Given** the owner selects an order from the left sidebar
**When** the selection registers
**Then** the OrderDetailPanel updates in the right panel showing: large table number, timestamp, full item list (name + variants), and a "Mark Handled" button — no full-page navigation

**Given** the owner clicks "Mark Handled" in the OrderDetailPanel
**When** the action completes
**Then** the button becomes muted, the sidebar OrderCard transitions to handled state, and the next unhandled order is auto-selected

**Given** no order is selected
**When** the right panel renders
**Then** an empty placeholder is shown in the right panel

**Given** the Admin UI is below `lg` (mobile/tablet)
**When** the orders page renders
**Then** the single-column compact list is used — no OrderDetailPanel is rendered

---

## Epic 6: Platform Administration

The platform admin can view all registered tenant restaurants, inspect any account's configuration, and access tenant data to resolve support issues.

### Story 6.1: Platform Admin Access & Tenant List

As a platform admin,
I want to log in to a protected admin panel and see a list of all registered restaurants,
So that I can quickly find any tenant when a support issue arises.

**Acceptance Criteria:**

**Given** a user with `is_platform_admin: true` on their `profiles` row navigates to `/platform`
**When** the middleware checks the DB flag server-side
**Then** access is granted and the tenant list page at `/platform/tenants` renders (FR40)

**Given** a user with `is_platform_admin: false` (including any restaurant owner) navigates to `/platform`
**When** the middleware checks
**Then** they are redirected — no platform admin content is visible and no privilege escalation path exists (NFR8)

**Given** the platform admin is on the tenant list
**When** the page renders
**Then** all registered restaurants are listed with name, slug, signup date, and published status

**Given** the tenant list is long
**When** the admin searches or scrolls
**Then** restaurants are scannable by name — the list is functional for a support lookup

---

### Story 6.2: Tenant Account Inspection & Data Access

As a platform admin,
I want to inspect any tenant's account details and access their data,
So that I can diagnose and resolve support issues without needing the restaurant owner to be present.

**Acceptance Criteria:**

**Given** the platform admin selects a restaurant from the tenant list
**When** they navigate to `/platform/tenants/[restaurant_id]`
**Then** the tenant detail page shows: restaurant name, slug, owner email, signup date, published status, table count, and menu item count (FR41)

**Given** the platform admin is on a tenant detail page
**When** they access the tenant's data
**Then** they can view that restaurant's menu items, tables, and recent orders (FR42)
**And** this access is granted via the `is_platform_admin` server-side check — the owner's RLS policies are bypassed using the service role client

**Given** the platform admin views a tenant's configuration
**When** the QR codes are checked
**Then** the admin can verify table configuration and QR URL correctness — addressing the Journey 4 support scenario directly

**Given** the platform admin accesses this page
**When** the data is fetched
**Then** all queries are scoped to the specific `restaurant_id` — the admin sees one tenant at a time, never a cross-tenant dump
