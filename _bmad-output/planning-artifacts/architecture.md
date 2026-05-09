---
stepsCompleted: [step-01-init, step-02-context, step-03-starter, step-04-decisions, step-05-patterns, step-06-structure, step-07-validation, step-08-complete]
lastStep: 8
status: 'complete'
completedAt: '2026-05-09'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'dine-in-cc'
user_name: 'Nic'
date: '2026-05-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
42 FRs across 7 categories: Restaurant Onboarding & Account Management (FR1–4),
Menu Management (FR5–15), Table & QR Management (FR16–19), Customer Ordering
(FR20–29), Order Management (FR30–33), Real-Time Order Delivery (FR34–35),
Multi-Tenancy & Access Control (FR36–39), Platform Administration (FR40–42).

Architecturally, the FRs divide into two distinct runtime surfaces with separate
session models: an anonymous mobile-web ordering flow (customer) and an authenticated
web Admin UI (restaurant owner). The real-time order pipeline bridging these two
surfaces is the core value delivery mechanism.

**Non-Functional Requirements:**
18 NFRs covering performance, security, reliability, accessibility, and scalability.

Architecturally load-bearing NFRs:
- NFR2: Orders appear in Admin UI within 5s — drives Realtime + polling fallback design
- NFR9/NFR10: No PII + mandatory RLS — constrains session design and DB access patterns
- NFR13: Graceful Realtime degradation to polling — fallback is load-bearing, not optional
- NFR14/15: WCAG 2.1 AA on both surfaces — must be built-in, not retrofitted
- NFR16: 50 concurrent customer sessions per restaurant — informs connection and query design
- NFR18: 6-month auto-purge — requires a scheduled job or Supabase pg_cron policy

**Scale & Complexity:**
- Primary domain: Full-stack web (mobile-web customer surface + responsive admin web)
- Complexity level: Medium
- Two runtime surfaces with different session models and UI requirements
- One real-time data pipeline as the critical path
- 7 custom UI components on top of design-md system

### Technical Constraints & Dependencies

- **Next.js** — application framework (full-stack, SSR/SSG + API routes)
- **Supabase** — database (Postgres + PostgREST), Auth (owner + anonymous customer), Realtime, Storage (menu images)
- **Cloudflare** — static asset hosting and edge routing
- **Tailwind CSS** — styling (sm/lg breakpoints; no md needed for MVP)
- **design-md (Apple-inspired)** — base design system; 7 custom components built on top
- Single region deployment for MVP
- Solo developer — scope is a hard constraint

### Cross-Cutting Concerns Identified

1. **Tenant isolation** — RLS policies on every table; JWT must carry `restaurant_id`; enforced at DB layer, not just app layer
2. **Anonymous customer session lifecycle** — issued on QR scan, scoped to `restaurant_id` + `table_id`, expires on inactivity; session strategy is a first-class design decision
3. **Real-time / polling fallback** — Supabase Realtime is the primary delivery path; 3–5s polling is the silent fallback; both must be handled in the Admin UI subscription layer
4. **WCAG 2.1 AA accessibility** — required on both surfaces; must be designed into custom components from the start
5. **Order data durability & retention** — orders must survive network interruption after server acknowledgement; 6-month auto-purge per tenant requires a scheduled mechanism
6. **Image storage and delivery** — menu item photos referenced in UX but not explicitly addressed in PRD; Supabase Storage is the natural fit but requires decisions on bucket structure, access policies, and CDN delivery

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web — Next.js (App Router) + Supabase + Cloudflare + Tailwind CSS,
based on PRD-specified tech stack.

### Starter Options Considered

| Option | Notes |
|---|---|
| `create-next-app -e with-supabase` (official) | Minimal, Supabase-maintained, SSR auth, Tailwind, TypeScript |
| Supa-Next-Starter | Adds TanStack Query + shadcn/ui — conflicts with design-md system choice |
| Nextbase | Adds Jest + Playwright + auto type-gen — more overhead than MVP warrants |

### Selected Starter: `create-next-app -e with-supabase`

**Rationale for Selection:**
The official Supabase starter is the leanest path to the required foundation.
It handles the highest-risk setup concern (SSR-safe cookie-based auth) correctly
out of the box, without pulling in a UI library that conflicts with the design-md
system defined in the UX specification. All additional tooling (testing, linting,
design system) can be layered on top incrementally.

**Initialization Command:**

```bash
npx create-next-app -e with-supabase dine-in-cc
```

Then install the design-md system:

```bash
npx getdesign@latest add apple
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript — strict mode. Next.js 16.2.6 on Node.js. Turbopack stable (default
for `next dev` and `next build`). React 19.2.

**Styling Solution:**
Tailwind CSS — included. design-md (Apple-inspired) installed on top via CLI.
No additional CSS-in-JS library.

**Build Tooling:**
Turbopack (Next.js 16 default). Standard `next build` for production.

**Testing Framework:**
Not included — to be added. Recommendation: Vitest + React Testing Library for
unit/component tests; Playwright for integration tests (RLS policy verification
is P0 per PRD risk mitigation).

**Code Organization:**
Next.js App Router conventions: `app/` directory, route groups, server vs client
components. Supabase client utilities in `utils/supabase/` (server, client,
middleware patterns).

**Development Experience:**
Hot reloading via Turbopack. TypeScript strict mode. Supabase local development
via Supabase CLI (`supabase start`).

**Note:** Project initialization using this command should be the first
implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- API access pattern: PostgREST direct from client + Server Actions for server-side ops
- QR URL structure: `/{restaurant_slug}/{table_number}` — slug chosen by owner, table number is integer
- Anonymous session expiry: 2 hours fixed
- Deployment adapter: `@opennextjs/cloudflare` (OpenNext for Cloudflare Workers)

**Important Decisions (Shape Architecture):**
- Schema migrations: Applied via Supabase dashboard or Supabase MCP directly
- Platform admin: DB flag (`is_platform_admin`) on user profiles table
- RLS testing: Playwright integration tests (P0 — must pass before production data)
- State management: Zustand
- Realtime subscription: One global subscription at Admin UI layout level
- Order submission: Pessimistic — confirmation only after server acknowledgement

**Deferred Decisions (Post-MVP):**
- ORM adoption (Drizzle/Prisma) — revisit if query complexity increases
- Cloudflare Workers vs Pages trade-off review post-MVP
- Staff sub-account RBAC implementation

---

### Data Architecture

**API Access Pattern:** PostgREST direct from client (authenticated via Supabase JWT).
RLS enforces all tenant isolation at the database layer. Next.js Server Actions
used for operations requiring server-side logic: image upload to Supabase Storage,
QR code generation, slug uniqueness validation.
*Provided by starter: No — explicit decision.*

**Schema Migrations:** Applied directly via Supabase dashboard SQL editor or
Supabase MCP. No Supabase CLI migration files tracked in git for MVP.
*Provided by starter: No — explicit decision.*

**Image Storage:** Single shared public Supabase Storage bucket.
Path structure: `restaurant_id/{item_id}/image`.
Bucket is public — menu item photos are served via CDN without auth.
Storage RLS policies restrict writes to authenticated restaurant owners scoped
to their own `restaurant_id`.
*Provided by starter: No — explicit decision.*

---

### Authentication & Security

**Owner Authentication:** Supabase Auth, email/password. SSR cookie-based session
via `supabase-ssr` package (included in starter). Tokens invalidated on logout (NFR7).
*Provided by starter: Yes.*

**Anonymous Customer Sessions:** Supabase anonymous auth. Token issued silently on
QR scan before menu renders. Token scoped to `restaurant_id` + `table_number` via
JWT custom claims. Expiry: **2 hours fixed** (no rolling refresh). No PII stored
at any point (NFR9).
*Provided by starter: Partial — anonymous auth supported; custom claims and expiry
are explicit decisions.*

**Platform Admin Designation:** `is_platform_admin: boolean` column on a `profiles`
table (default `false`). Checked server-side on every platform admin route via
middleware. No privilege escalation path from restaurant owner accounts (NFR8).
Set manually via Supabase dashboard.
*Provided by starter: No — explicit decision.*

**RLS Testing Strategy:** Playwright integration tests running against local Supabase
(`supabase start`). Tests create two tenant fixtures, verify cross-tenant reads return
empty sets, and verify anonymous tokens cannot access other restaurant data.
**These tests are P0 — they must pass before any production data exists.**
*Provided by starter: No — explicit decision.*

---

### API & Communication Patterns

**QR URL Structure:** `https://app.dine-in-cc.com/{restaurant_slug}/{table_number}`

- `restaurant_slug`: chosen by restaurant owner during onboarding. Validated:
  lowercase alphanumeric + hyphens, no spaces, 3–50 characters. `UNIQUE` constraint
  on DB column. Conflict surfaced at onboarding with inline error.
- `table_number`: human-readable integer (e.g. `5`). DB primary key is UUID internally;
  `table_number` is a separate display/routing field with a `UNIQUE` constraint
  scoped per restaurant.
- Next.js route: `app/[restaurant_slug]/[table_number]/page.tsx`
*Provided by starter: No — explicit decision.*

**Order Submission Flow:** Pessimistic. UI waits for Supabase insert acknowledgement
before showing confirmation screen. On failure: inline retry prompt, cart preserved
(NFR12). Matches UX spec "Tap to retry — order not lost" pattern.
*Provided by starter: No — explicit decision.*

**Realtime Subscription:** One global Supabase Realtime subscription mounted at the
Admin UI layout level (`app/admin/layout.tsx`), in a Client Component. Subscribes to
all orders for the authenticated restaurant on mount. Polling fallback (3–5s interval)
activates silently if Realtime is unavailable (NFR13). Subscription persists across
tab navigation so no orders are missed mid-navigation.
*Provided by starter: No — explicit decision.*

---

### Frontend Architecture

**Route Structure:**
```
app/
  [restaurant_slug]/
    [table_number]/      ← Customer ordering flow (anonymous session)
  admin/
    layout.tsx           ← Global Realtime subscription (Client Component)
    orders/
    menu/
    tables/
    settings/
  platform/              ← Platform admin (is_platform_admin DB flag check)
    tenants/
  (auth)/
    login/
    signup/
```

**State Management:** Zustand. Primary use cases:
- Cart state (Aisha's in-progress order) — ephemeral, client-only
- Order feed state (Admin UI) — populated by Realtime subscription handler,
  which runs outside the React tree and requires store access without a hook
*Provided by starter: No — explicit decision.*

**Server vs Client Component Split:**
- Customer menu page: Server Component (SSR menu fetch for fast initial load) →
  Client Component islands for CartBar, ItemConfigSheet, order submission
- Admin order feed: Client Component (Realtime + Zustand store)
  within Server Component layout shell
- Menu builder: Client Components throughout (interactive forms, auto-save)
*Provided by starter: No — explicit decision.*

---

### Infrastructure & Deployment

**Hosting:** Cloudflare Workers via **`@opennextjs/cloudflare`** (OpenNext adapter).
Edge runtime — no Node.js native APIs. Supabase JS client is edge-compatible.
Local development: Wrangler CLI alongside Supabase local dev.
*Provided by starter: No — explicit decision.*

**CI/CD:** GitHub Actions.
- On PR: run Playwright RLS integration tests against local Supabase
- On merge to main: deploy to Cloudflare Workers via `wrangler deploy`
- Cloudflare API token stored in GitHub Actions secrets
*Provided by starter: No — explicit decision.*

**Monitoring & Logging:** Sentry (free tier). Wired up to catch runtime errors on
both customer flow and Admin UI. Cloudflare Workers native analytics for request
metrics. Supabase dashboard for DB query performance.
*Provided by starter: No — explicit decision.*

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

8 areas where AI agents could independently make incompatible choices:
database naming, file/component naming, Supabase client usage, Server Action
error format, Zustand store structure, Realtime event handling, loading state
patterns, and RLS policy conventions.

---

### Naming Patterns

**Database Naming Conventions:**
- Tables: plural `snake_case` — `restaurants`, `menu_items`, `orders`, `tables`
- Columns: `snake_case` — `restaurant_id`, `created_at`, `is_published`
- Foreign keys: `{singular_table}_id` — `restaurant_id`, `menu_item_id`
- Boolean columns: `is_` prefix — `is_published`, `is_handled`, `is_platform_admin`
- Timestamp columns: `_at` suffix — `created_at`, `handled_at`, `submitted_at`
- Primary keys: always `id uuid DEFAULT gen_random_uuid()`
- Unique routing fields: `slug` (restaurants), `number` (tables)

**File & Directory Naming:**
- Page files: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (Next.js conventions)
- Component files: PascalCase — `MenuItemRow.tsx`, `CartBar.tsx`, `OrderCard.tsx`
- Hook files: camelCase with `use` prefix — `useCart.ts`, `useOrders.ts`
- Utility files: camelCase — `formatPrice.ts`, `generateQrUrl.ts`
- Store files: camelCase with `Store` suffix — `cartStore.ts`, `orderStore.ts`
- Server Action files: camelCase with `actions` suffix — `orderActions.ts`, `menuActions.ts`

**TypeScript Naming:**
- Interfaces/Types: PascalCase — `MenuItem`, `Order`, `Restaurant`, `TableRow`
- Supabase generated types: imported from `@/types/supabase` (generated file)
- Zustand store types: `{Name}Store` — `CartStore`, `OrderStore`
- Props types: `{ComponentName}Props` — `MenuItemRowProps`, `CartBarProps`

**Function Naming:**
- Server Actions: verb + noun — `submitOrder`, `publishMenu`, `createTable`
- Event handlers: `handle` prefix — `handleAddToCart`, `handleMarkHandled`
- Utility functions: verb + noun — `formatPrice`, `generateQrUrl`, `validateSlug`

---

### Structure Patterns

**Project Organization:**
```
app/
  [restaurant_slug]/[table_number]/   ← Customer flow
  admin/                              ← Owner Admin UI
  platform/                          ← Platform admin
  (auth)/                             ← Auth pages
components/
  customer/     ← MenuItemRow, ItemConfigSheet, CartBar, OrderConfirmationScreen
  admin/        ← OrderCard, OrderDetailPanel, OnboardingChecklist
  shared/       ← Reusable across surfaces
stores/
  cartStore.ts
  orderStore.ts
actions/
  orderActions.ts
  menuActions.ts
  tableActions.ts
utils/
  supabase/     ← server.ts, client.ts, middleware.ts (from starter)
  formatPrice.ts
  generateQrUrl.ts
  validateSlug.ts
types/
  supabase.ts   ← Generated Supabase types (do not edit manually)
  app.ts        ← App-level types not generated by Supabase
tests/
  rls/          ← Playwright RLS integration tests (P0)
  e2e/          ← End-to-end flow tests
```

**Test File Location:**
- RLS integration tests: `tests/rls/` — never co-located with source
- E2E tests: `tests/e2e/`
- Unit tests (if added): co-located as `ComponentName.test.tsx`

---

### Format Patterns

**Server Action Return Format:**
All Server Actions return a consistent discriminated union:
```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```
Never throw from a Server Action — always return the error shape.
Client code always checks `result.success` before using `result.data`.

**Supabase Query Pattern:**
```typescript
const { data, error } = await supabase.from('orders').select('*')
if (error) return { success: false, error: error.message }
return { success: true, data }
```
Never access `.data` without checking `.error` first.

**Date/Time Format:**
- Storage: ISO 8601 strings in Postgres (`timestamptz`)
- Display: formatted client-side using `Intl.DateTimeFormat` — never moment.js/date-fns
- Relative times (order timestamps): `formatDistanceToNow` pattern implemented
  once in `utils/formatTime.ts`, used everywhere

**Price Format:**
- Storage: integer cents in DB — `price_cents: integer` (e.g., 1500 = $15.00)
- Display: formatted via `utils/formatPrice.ts` — `formatPrice(1500)` → `"$15.00"`
- Never store floats for currency

---

### Communication Patterns

**Zustand Store Structure:**
```typescript
// Each store: state + actions in one object, no separate slices
const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  clearCart: () => set({ items: [] }),
}))
```
- One store per domain (`cartStore`, `orderStore`)
- Actions defined inside the store, not outside
- No direct state mutation — always use `set()`

**Realtime Event Handling:**
```typescript
// Pattern for Admin UI Realtime subscription
supabase
  .channel('orders')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders',
      filter: `restaurant_id=eq.${restaurantId}` },
    (payload) => useOrderStore.getState().addOrder(payload.new as Order)
  )
  .subscribe()
```
- Always filter by `restaurant_id` — never subscribe to all orders globally
- Access Zustand store via `getState()` inside Realtime callbacks (not hooks)
- Polling fallback: `setInterval` at 4000ms, cleared when Realtime reconnects

---

### Process Patterns

**Loading States:**
- Use Next.js `loading.tsx` for route-level skeletons (Server Component pages)
- Use local `isLoading: boolean` state in Client Components for action loading
- Skeleton components match the real layout exactly — no generic spinners
- Never show a spinner for actions under 300ms — use optimistic local state instead
  (exception: order submission is pessimistic — show loading until server ack)

**Error Handling:**
- Server Actions: always return `ActionResult` union — never throw
- Client Components: `try/catch` around Server Action calls, display inline error
- Supabase queries: always destructure `{ data, error }`, never ignore `error`
- Unhandled runtime errors: caught by Sentry automatically + Next.js `error.tsx`
- User-facing error copy: always actionable — "Tap to try again", never "An error occurred"

**Form Validation:**
- Validate on blur (not on keystroke) for text inputs
- Server-side revalidation in Server Actions — never trust client-only validation
- Required field errors shown inline below the field, in error color (`#FF3B30`)
- Slug validation: client-side format check (regex) + server-side uniqueness check

---

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `price_cents` (integer) for all price fields — never floats
- Return `ActionResult<T>` from every Server Action — never throw
- Filter all Supabase queries by `restaurant_id` — RLS is the safety net, not the only check
- Check `error` before `data` on every Supabase response
- Use `useOrderStore.getState()` (not hooks) inside Realtime callbacks
- Name boolean DB columns with `is_` prefix
- Place RLS tests in `tests/rls/` — never skip before production deploy

**Anti-Patterns to Avoid:**
- `price: float` or `price: number` — use `price_cents: integer`
- `throw new Error(...)` inside a Server Action
- `supabase.from('orders').select('*')` without a `restaurant_id` filter in app code
- `const { data } = await supabase...` (ignoring error)
- Accessing Zustand store with `useCartStore()` inside a Realtime callback
- `setTimeout` instead of `setInterval` for the polling fallback loop
- Hardcoded color values — always use design tokens from the design-md system

## Project Structure & Boundaries

### Requirements to Directory Mapping

| FR Category | Primary Location |
|---|---|
| FR1–4 Onboarding & Auth | `app/(auth)/`, `actions/authActions.ts` |
| FR5–15 Menu Management | `app/admin/menu/`, `components/admin/`, `actions/menuActions.ts` |
| FR16–19 Table & QR | `app/admin/tables/`, `components/admin/`, `actions/tableActions.ts` |
| FR20–29 Customer Ordering | `app/[restaurant_slug]/[table_number]/`, `components/customer/` |
| FR30–33 Order Management | `app/admin/orders/`, `components/admin/` |
| FR34–35 Real-Time Delivery | `stores/orderStore.ts`, `app/admin/layout.tsx`, `components/shared/RealtimeProvider.tsx` |
| FR36–39 Multi-Tenancy | `middleware.ts`, `utils/supabase/`, `tests/rls/` |
| FR40–42 Platform Admin | `app/platform/` |

---

### Complete Project Directory Structure

```
dine-in-cc/
├── .github/
│   └── workflows/
│       └── ci.yml                        ← RLS tests on PR; deploy to CF Workers on main
├── .gitignore
├── .env.local                            ← SUPABASE_URL, SUPABASE_ANON_KEY, SENTRY_DSN
├── .env.example
├── next.config.ts                        ← @opennextjs/cloudflare adapter config
├── wrangler.toml                         ← Cloudflare Workers name, routes, bindings
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── app/
│   ├── globals.css
│   ├── layout.tsx                        ← Root layout + Sentry init
│   ├── not-found.tsx
│   │
│   ├── [restaurant_slug]/
│   │   └── [table_number]/
│   │       ├── page.tsx                  ← Customer ordering (SSR menu fetch) [FR20–29]
│   │       ├── loading.tsx               ← Menu skeleton
│   │       └── error.tsx                 ← Menu unavailable state [FR20]
│   │
│   ├── admin/
│   │   ├── layout.tsx                    ← Auth guard + global Realtime subscription [FR34–35]
│   │   ├── page.tsx                      ← Dashboard + OnboardingChecklist [Journey 2]
│   │   ├── orders/
│   │   │   ├── page.tsx                  ← Order feed, Active/Handled tabs [FR30–33]
│   │   │   └── loading.tsx
│   │   ├── menu/
│   │   │   ├── page.tsx                  ← Menu item list by category [FR9, FR10–12]
│   │   │   ├── new/
│   │   │   │   └── page.tsx              ← New menu item form [FR5–8]
│   │   │   └── [item_id]/
│   │   │       └── page.tsx              ← Edit menu item [FR10, FR13–15]
│   │   ├── tables/
│   │   │   ├── page.tsx                  ← Table list + QR generation [FR16–19]
│   │   │   └── loading.tsx
│   │   └── settings/
│   │       └── page.tsx                  ← Restaurant profile, slug, billing [FR1–2]
│   │
│   ├── platform/
│   │   ├── layout.tsx                    ← is_platform_admin guard [NFR8]
│   │   └── tenants/
│   │       ├── page.tsx                  ← Tenant list [FR40]
│   │       └── [restaurant_id]/
│   │           └── page.tsx              ← Tenant detail / account inspection [FR41–42]
│   │
│   └── (auth)/
│       ├── login/page.tsx                ← [FR3]
│       ├── signup/page.tsx               ← [FR1–2]
│       └── reset-password/page.tsx       ← [FR4]
│
├── components/
│   ├── customer/
│   │   ├── MenuItemRow.tsx               ← [FR21, FR23] image + name + price row
│   │   ├── ItemConfigSheet.tsx           ← [FR24] bottom sheet variant selector
│   │   ├── CartBar.tsx                   ← [FR25–26] persistent bottom cart bar
│   │   ├── OrderConfirmationScreen.tsx   ← [FR28] full-screen closed-loop confirmation
│   │   ├── CategoryTabs.tsx              ← [FR21] horizontal category navigation
│   │   └── MenuSkeleton.tsx              ← loading state for customer menu
│   ├── admin/
│   │   ├── OrderCard.tsx                 ← [FR31, FR32] compact order row
│   │   ├── OrderDetailPanel.tsx          ← [FR31] desktop right-panel order detail
│   │   ├── OrderFeed.tsx                 ← [FR30, FR35] Realtime-connected feed (Client Component)
│   │   ├── OnboardingChecklist.tsx       ← Journey 2 setup guide
│   │   ├── MenuItemForm.tsx              ← [FR5–12] item create/edit form with auto-save
│   │   ├── VariantEditor.tsx             ← [FR6–7] variant group + price editor
│   │   ├── AvailabilitySchedule.tsx      ← [FR8] day + time window picker
│   │   ├── CategoryManager.tsx           ← [FR9, FR12] category CRUD + item reorder
│   │   ├── MenuPreview.tsx               ← [FR13] mirrors customer view exactly
│   │   ├── TableCard.tsx                 ← [FR16–19] table row with QR actions
│   │   └── QrCodeDisplay.tsx             ← [FR17–18] rendered QR + download/print
│   └── shared/
│       ├── RealtimeProvider.tsx          ← wraps admin layout, manages WS + polling fallback
│       └── ErrorBoundary.tsx
│
├── stores/
│   ├── cartStore.ts                      ← Zustand: customer in-progress order [FR25–26]
│   └── orderStore.ts                     ← Zustand: admin order feed state [FR30, FR34–35]
│
├── actions/
│   ├── orderActions.ts                   ← submitOrder, markOrderHandled
│   ├── menuActions.ts                    ← createMenuItem, updateMenuItem, deleteMenuItem,
│   │                                        publishMenu, takeMenuOffline
│   ├── tableActions.ts                   ← createTable, deleteTable, generateQrUrl
│   └── authActions.ts                    ← signup, login, logout, resetPassword
│
├── utils/
│   ├── supabase/
│   │   ├── server.ts                     ← SSR Supabase client (from starter)
│   │   ├── client.ts                     ← Browser Supabase client (from starter)
│   │   └── middleware.ts                 ← Session refresh (from starter)
│   ├── formatPrice.ts                    ← price_cents integer → "$15.00" string
│   ├── formatTime.ts                     ← relative + absolute timestamp formatting
│   ├── generateQrUrl.ts                  ← builds /{slug}/{table_number} URL
│   └── validateSlug.ts                   ← regex format check + uniqueness helper
│
├── types/
│   ├── supabase.ts                       ← Supabase generated types (DO NOT EDIT)
│   └── app.ts                            ← MenuItem, Order, Restaurant, CartItem, etc.
│
├── middleware.ts                         ← Session refresh + route protection
│
└── tests/
    ├── rls/                              ← P0 — must pass before any production deploy
    │   ├── tenant-isolation.spec.ts      ← cross-tenant reads return empty
    │   ├── anonymous-session.spec.ts     ← anon token scoped to restaurant + table only
    │   └── platform-admin.spec.ts        ← admin access; no escalation from owner
    └── e2e/
        ├── customer-flow.spec.ts         ← QR scan → browse → order → confirmation
        └── admin-order-flow.spec.ts      ← order appears in Admin UI within 5s
```

---

### Architectural Boundaries

**API Boundaries:**

| Actor | Method | Target | Auth |
|---|---|---|---|
| Customer (Aisha) | PostgREST direct | `menu_items`, `orders` tables | Anonymous JWT (restaurant_id + table_number claims) |
| Restaurant Owner (Marco) | PostgREST direct | All restaurant-scoped tables | Owner JWT (email/password session) |
| Server Actions | Supabase server client | Image upload, QR generation, slug validation | Service role (server-side only) |
| Admin UI | Supabase Realtime | `orders` channel, `restaurant_id` filter | Owner JWT |
| Platform Admin (Nic) | PostgREST direct | All tenant data | Owner JWT + `is_platform_admin` DB flag |

**Data Boundaries:**
- All tables carry a `restaurant_id` foreign key — RLS policies enforce tenant scope at DB layer
- Customer anonymous sessions: scoped JWT claims, 2-hour expiry, no PII stored
- Menu images: public bucket, write-protected by Storage RLS on `restaurant_id`
- Order history: auto-purged at 6 months via Supabase `pg_cron` scheduled job

**Component Boundaries:**
- Customer surface (`app/[restaurant_slug]/[table_number]/`): isolated route group, no shared layout with admin
- Admin surface (`app/admin/`): shared layout with global Realtime subscription; all pages behind auth guard
- Platform admin (`app/platform/`): separate layout with `is_platform_admin` check; no shared state with admin surface

---

### Data Flow

**Customer Ordering Flow:**
```
QR scan → app/[slug]/[table]/page.tsx (SSR menu fetch via server Supabase client)
        → anonymous JWT issued in middleware
        → components/customer/* (cart managed in cartStore)
        → actions/orderActions.ts submitOrder (Server Action)
        → Supabase orders table INSERT
        → OrderConfirmationScreen shown on server ack
```

**Real-Time Order Delivery Flow:**
```
Supabase orders INSERT
  → Realtime channel pushes postgres_changes event
  → RealtimeProvider.tsx callback → useOrderStore.getState().addOrder()
  → OrderFeed.tsx re-renders with new OrderCard
  [fallback: setInterval 4000ms polls orders table if Realtime unavailable]
```

**Admin Menu Setup Flow:**
```
MenuItemForm.tsx (auto-save debounced 2s)
  → actions/menuActions.ts (Server Action)
  → Supabase menu_items INSERT/UPDATE
  → publishMenu() → sets is_published = true on restaurant record
  → OnboardingChecklist marks step complete
```

---

### External Integration Points

| Service | Integration Point | Purpose |
|---|---|---|
| Supabase Auth | `utils/supabase/server.ts`, `middleware.ts` | Owner sessions + anonymous customer tokens |
| Supabase PostgREST | All data reads/writes | Menu, orders, tables, restaurants |
| Supabase Realtime | `stores/orderStore.ts` via `RealtimeProvider.tsx` | Live order delivery to Admin UI |
| Supabase Storage | `actions/menuActions.ts` (server-side upload) | Menu item photos |
| Cloudflare Workers | `wrangler.toml`, `next.config.ts` | Hosting via `@opennextjs/cloudflare` |
| Sentry | `app/layout.tsx` init + `error.tsx` boundaries | Runtime error capture |
| GitHub Actions | `.github/workflows/ci.yml` | RLS tests on PR + deploy on merge |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are mutually compatible. Next.js 16 App Router, Supabase JS
2.105.3, supabase-ssr, Zustand, Tailwind CSS, @opennextjs/cloudflare, Sentry, and
Playwright work together without conflicts.

**Pattern Consistency:**
ActionResult<T> return shape, Supabase { data, error } query pattern, Zustand store
structure, and Realtime subscription pattern are internally consistent and aligned
with the chosen stack.

**Structure Alignment:**
Route structure is valid Next.js App Router. Component boundaries respect Server/Client
Component split decisions. Test organization aligns with P0 priority for RLS tests.

**Known Risk — Verify at Project Init:**
`@opennextjs/cloudflare` compatibility with Next.js 16 must be confirmed as the very
first step of implementation. If the adapter lags behind Next.js 16, downgrade to the
latest supported Next.js version before proceeding.

---

### Requirements Coverage Validation ✅

All 42 Functional Requirements and 18 Non-Functional Requirements have architectural
support. See Project Structure section for FR-to-directory mapping.

**Notable NFR coverage:**
- NFR2 (<5s order delivery): Realtime + 4s polling fallback
- NFR9 (no PII): anonymous sessions only, no customer data stored
- NFR10 (mandatory RLS): enforced at DB layer; app-level checks are secondary
- NFR12 (order durability): pessimistic submission with retry on failure
- NFR13 (graceful Realtime degradation): silent 4s polling fallback
- NFR18 (6-month auto-purge): pg_cron scheduled job in Supabase

---

### Gap Analysis Results

**Important Gap Resolved: Anonymous JWT Custom Claims Mechanism**

The architecture states anonymous tokens are scoped via JWT custom claims, but the
mechanism was unspecified. Resolved as follows:

**Implementation pattern for anonymous session scoping:**

1. Customer scans QR → Next.js server-side page runs for `[restaurant_slug]/[table_number]`
2. Server-side: resolve `restaurant_id` from `restaurant_slug` (Supabase server query)
3. Server Action issues anonymous auth: `supabase.auth.admin.createUser({ is_anonymous: true })`
   then sets `app_metadata: { restaurant_id, table_number }` via admin client
4. Supabase Auth Hook (SQL function `custom_access_token_hook`) injects `app_metadata`
   into the JWT
5. RLS policies reference: `(auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid`

**RLS policy pattern for anonymous customer access:**
```sql
-- Orders: customer can INSERT for their own restaurant + table only
CREATE POLICY "customer_insert_order" ON orders
  FOR INSERT TO anon
  WITH CHECK (
    restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND table_number = (auth.jwt() -> 'app_metadata' ->> 'table_number')::integer
  );

-- Menu items: customer can SELECT published items for their restaurant only
CREATE POLICY "customer_read_menu" ON menu_items
  FOR SELECT TO anon
  USING (
    restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
    AND is_published = true
  );
```

This pattern must be implemented in `tests/rls/anonymous-session.spec.ts` (P0).

**Minor Gap: pg_cron order purge not detailed**
The 6-month auto-purge (NFR18) requires a Supabase pg_cron job. This is a post-launch
operational task, not a blocker for MVP. Add as a post-launch implementation note.

---

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all 16 checklist items confirmed, one important gap
(anonymous JWT claims mechanism) resolved during validation.

**Key Strengths:**
- RLS-first multi-tenancy with explicit test suite as a hard gate before production
- Realtime + polling fallback ensures order delivery reliability regardless of WebSocket availability
- Pessimistic order submission + retry pattern eliminates lost orders
- Server-first rendering for customer menu maximises initial load performance
- Clear Server/Client Component split keeps bundle small on the customer surface
- Consistent ActionResult<T> pattern prevents silent error swallowing across all Server Actions

**Areas for Future Enhancement (Post-MVP):**
- pg_cron order purge policy (NFR18)
- ORM adoption (Drizzle) if query complexity increases
- Staff sub-account RBAC
- Cloudflare Workers vs Pages re-evaluation at scale

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries defined in this document
- Refer to this document for all architectural questions

**First Implementation Steps (in order):**
1. `npx create-next-app -e with-supabase dine-in-cc` — verify @opennextjs/cloudflare + Next.js 16 compatibility
2. Configure `wrangler.toml` and `next.config.ts` for Cloudflare Workers
3. `npx getdesign@latest add apple` — install design-md system
4. Set up Supabase Auth Hook for anonymous JWT custom claims
5. Write and pass `tests/rls/` suite before any production data
