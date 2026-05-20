---
project_name: 'dine-in-cc'
user_name: 'Nic'
date: '2026-05-20'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'anti_patterns']
status: 'complete'
rule_count: 52
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing code in this project. Focused on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Next.js** latest, App Router — no Pages Router patterns
- **React** ^19.0.0
- **TypeScript** ^5, strict mode enabled
- **@supabase/supabase-js** latest | **@supabase/ssr** latest
- **Tailwind CSS** ^3.4.1 + tailwindcss-animate ^1.0.7
- **Zustand** ^5.0.13
- **@opennextjs/cloudflare** ^1.19.8 — Cloudflare Workers runtime (no Node.js native APIs)
- **Sentry** ^10.51.0 (nextjs integration)
- **@dnd-kit/core** ^6.3.1 + **@dnd-kit/sortable** ^10.0.0
- **qrcode** ^1.5.4
- **Vitest** ^4.1.5 + React Testing Library ^16.3.2 (unit/component tests)
- **Playwright** ^1.59.1 (RLS integration tests + E2E tests)
- **Wrangler** ^4.90.0

**Version constraints:**
- `@supabase/ssr` and `@supabase/supabase-js` pinned to `"latest"` — only `package-lock.json` guards stability; do not bump without testing
- `@opennextjs/cloudflare` compatibility with Next.js must be verified before any major Next.js upgrade

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- `strict: true` is enforced — no `any` escapes; use `unknown` + type guard when type is genuinely unknown
- Path alias `@/*` maps to project root — always import with `@/`, never relative `../`
- `types/supabase.ts` is auto-generated — **never edit manually**; regenerate with `supabase gen types` after schema changes
- `types/app.ts` contains all hand-authored domain types — add new types here, not inline in component files
- `PriceCents = number` type alias exists — use it for price fields to signal integer cents intent
- Server-only modules (`lib/supabase/admin.ts`) use `import 'server-only'` guard — never import from Client Components
- `createClient` is exported by both `lib/supabase/server.ts` and `lib/supabase/client.ts` — import from the correct path (they share a name intentionally)
- Server Actions **never throw** — always return `ActionResult<T>` union
- Client code always checks `result.success` before accessing `result.data`
- Supabase queries: always destructure `{ data, error }`; never access `data` without checking `error` first

### Framework-Specific Rules

**Next.js (App Router)**
- All data-fetching pages are Server Components by default — only add `'use client'` when the component needs browser APIs, event handlers, hooks, or Realtime
- Customer menu page uses the **admin client** for SSR — never the server (cookie) client; anonymous visitors have no session
- `params` in App Router page components is a `Promise` in Next.js 15+ — always `await params` before destructuring
- Route group `(auth)` uses parentheses — the folder name is not part of the URL
- Never put shared state in Server Components — use Zustand or React state in Client Components

**Supabase Client Selection — wrong client = silent data bugs**

Three clients, three distinct use cases. Full rules: `docs/conventions/supabase-clients.md`

| Client | Import path | Use for |
|---|---|---|
| Server (cookie) | `lib/supabase/server.ts` → `createClient()` | Owner Server Actions + Server Components needing the owner's JWT |
| Admin (service role) | `lib/supabase/admin.ts` → `createAdminClient()` | Customer-facing SSR reads; admin-only mutations. **Never for customer writes** |
| Browser | `lib/supabase/client.ts` → `createClient()` | Client Component reads + Realtime subscriptions |

- Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **not** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase client files live at `lib/supabase/` — **not** `utils/supabase/`

**Sessionless customer flow (superseded anonymous-JWT design on 2026-05-18)**
- No `auth.users` rows are created for customers
- `submitOrder` Server Action validates `(restaurantSlug, tableNumber)` server-side using the **admin client**, then admin-inserts the order
- Customer-facing RLS policies remain in the DB as dormant defense-in-depth only
- The architecture doc describes the old anonymous-JWT path — **it is not implemented**; `actions/customerActions.ts` with `initAnonymousSession` does not exist

**Realtime subscriptions**
```ts
// REQUIRED before .subscribe() — skipping this is #1 reason callbacks never fire
const { data: { session } } = await supabase.auth.getSession()
if (session?.access_token) await supabase.realtime.setAuth(session.access_token)
```
- Always use the **browser client** for Realtime (not server client)
- Always filter by `restaurant_id` — channel filter does not replace RLS
- Access Zustand store via `useOrderStore.getState()` inside Realtime callbacks — never call hooks inside callbacks

**Zustand**
- One store per domain: `stores/cartStore.ts`, `stores/orderStore.ts`
- State + actions defined together in one `create()` call — no separate slices
- Never mutate state directly — always use `set()`
- Outside React tree (Realtime callbacks): use `store.getState()`

**Server Actions**
- File must start with `'use server'`
- Return type is always `Promise<ActionResult<T>>` — never `void`, never throws
- Input validation at the top of every action before any DB call
- User-facing error strings must be actionable: `"Tap to try again"` not `"Error occurred"`

### Testing Rules

**Three test layers — different runners, different purposes**

| Layer | Location | Runner | Purpose |
|---|---|---|---|
| Unit/component | `tests/unit/` or co-located `*.test.tsx` | Vitest | Logic, components, utilities |
| RLS integration | `tests/rls/` | Playwright | Tenant isolation, policy verification |
| E2E | `tests/e2e/` | Playwright | Full user flows against real Supabase |

Commands: `npm run test` (Vitest), `npm run test:rls`, `npm run test:e2e`

**RLS tests are P0**
- Must pass before any production data exists
- Run against local Supabase (`supabase start`) — never against production
- Shared helpers in `tests/rls/helpers.ts` — use them; never re-implement fixture creation inline
- `createTestOwner` / `createTestPlatformAdmin`: wrap in try/finally tracking IDs for cleanup (partial failure orphans auth users)

**Mock discipline**
- Do **not** mock Supabase in RLS or E2E tests — must hit a real DB (mocked tests passed while prod RLS failed; real incident)
- Unit tests may mock Supabase client methods for component isolation; any test touching auth or RLS must use the real client

**Vitest config**
- `jsdom` environment; `tests/rls/**` and `tests/e2e/**` are excluded from Vitest runs
- `@/` imports resolve in tests via `vite-tsconfig-paths`

### Code Quality & Style Rules

**File & directory naming**
- Components: PascalCase — `MenuItemRow.tsx`, `CartBar.tsx`
- Hooks: camelCase with `use` prefix — `useCart.ts`
- Utilities: camelCase — `formatPrice.ts`, `generateQrUrl.ts`
- Stores: camelCase with `Store` suffix — `cartStore.ts`
- Server Action files: camelCase with `Actions` suffix — `orderActions.ts`

**Component directory placement**
- `components/customer/` — customer ordering surface only
- `components/admin/` — Admin UI only
- `components/shared/` — used on both surfaces

**TypeScript naming**
- Types/Interfaces: PascalCase — `MenuItem`, `Order`, `CartItem`
- Props types: `{ComponentName}Props`
- Server Actions: verb + noun — `submitOrder`, `publishMenu`
- Event handlers: `handle` prefix — `handleAddToCart`

**Database naming**
- Tables: plural `snake_case`; boolean columns: `is_` prefix; timestamps: `_at` suffix
- Primary keys: `id uuid DEFAULT gen_random_uuid()`

**Price & currency**
- Storage: `price_cents: integer` (1500 = $15.00) — never floats
- Display: always via `utils/formatPrice.ts` — never format inline

**Date & time**
- Display: `Intl.DateTimeFormat` — never moment.js or date-fns (not installed)
- Relative times: `utils/formatTime.ts` — use it everywhere, don't reimplement

**Styling**
- Tailwind CSS only — no CSS-in-JS, no inline `style=` for layout
- Never hardcode color hex values — use design-md system tokens
- Breakpoints: `sm` and `lg` only (no `md` per UX spec)

**Comments**
- Default: no comments — well-named identifiers are self-documenting
- Add a comment only when the WHY is non-obvious (hidden constraint, workaround, subtle invariant)

### Critical Don't-Miss Rules

**Anti-patterns — never do these**

| Anti-pattern | Correct pattern |
|---|---|
| `price: number` or `price: float` | `price_cents: number` (integer cents) |
| `throw new Error(...)` in a Server Action | `return { success: false, error: '...' }` |
| `const { data } = await supabase...` | Always `const { data, error } = ...` and check `error` |
| `useCartStore()` inside a Realtime callback | `useCartStore.getState()` |
| `setTimeout` for polling fallback | `setInterval` at 4000ms, cleared on Realtime reconnect |
| Hardcoded color hex values | Design-md system tokens via Tailwind classes |
| `.insert(row).select().single()` for customer writes | `.insert(row)` only — no RETURNING on customer INSERTs |
| Importing `lib/supabase/admin.ts` from a Client Component | Admin client is `server-only` — Server Actions/pages only |
| `utils/supabase/` import path | Correct path is `lib/supabase/` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Correct name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

**The `42501` PostgreSQL error trap**

Error `42501` covers two distinct failures that look identical from the client:
1. `WITH CHECK` returned false (insert blocked by policy)
2. Implicit SELECT on `INSERT ... RETURNING` blocked by SELECT RLS

Diagnosis: retry the INSERT without `.select()`. If it succeeds, the failure was on the RETURNING/SELECT side. Default rule for customer-facing INSERTs: **no `.select()`**.

**Do not re-introduce the JWT customer session path**

The anonymous-JWT design was removed 2026-05-18. Do not:
- Create `auth.users` rows for customers
- Call `supabase.auth.admin.createUser({ is_anonymous: true })` for customer flows
- Implement `initAnonymousSession` or similar
All customer validation is inside `submitOrder` Server Action via admin client.

**Cloudflare Workers runtime constraints**
- No Node.js native APIs (`fs`, `crypto` module, `Buffer` from Node)
- `crypto.randomUUID()` available (Web Crypto API) in HTTPS contexts only
- Verify edge compatibility before installing any new dependency

**RLS is a safety net, not the only check**
- Always filter Supabase queries by `restaurant_id` in app code — defense in depth
- Never trust client-supplied `restaurant_id` — derive server-side from JWT via `get_my_restaurant_id()` DB function

**Platform admin security**
- Layout guard does NOT run for Server Action endpoints — every platform Server Action must re-check `is_platform_admin` independently
- Platform admin flag set manually via Supabase dashboard only — no escalation path

**Schema changes**
- Applied via Supabase dashboard SQL editor or Supabase MCP — no CLI migration files tracked in git
- After any schema change: regenerate `types/supabase.ts` with `supabase gen types` and commit

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project
- Follow ALL rules exactly as documented
- When client selection is ambiguous, consult `docs/conventions/supabase-clients.md`
- The architecture doc (`_bmad-output/planning-artifacts/architecture.md`) describes some patterns that were superseded — this file takes precedence for the customer flow and Supabase client paths

**For Humans:**
- Update this file when the technology stack or patterns change
- Regenerate after any major sprint change proposal is accepted
- Keep it lean — remove rules that become obvious over time

Last Updated: 2026-05-20
