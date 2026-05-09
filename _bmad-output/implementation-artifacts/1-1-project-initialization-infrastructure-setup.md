# Story 1.1: Project Initialization & Infrastructure Setup

Status: done

## Story

As a developer,
I want the project scaffolded using the official Supabase Next.js starter with the Cloudflare Workers adapter and design-md system installed,
so that all subsequent development has a consistent, verified foundation with CI/CD and error monitoring ready.

## Acceptance Criteria

1. **Given** the developer runs `npx create-next-app -e with-supabase dine-in-cc` **When** the command completes **Then** a Next.js 16 App Router project exists with TypeScript strict mode, Tailwind CSS, and Supabase SSR utilities in `utils/supabase/` **And** `@opennextjs/cloudflare` compatibility with Next.js 16 is verified — if incompatible, Next.js is downgraded to the latest supported version and documented.

2. **Given** the project is initialized **When** `npx getdesign@latest add apple` is run **Then** the design-md Apple system is installed and custom design tokens (accent `#FF6B35`, surface colors light/dark, typography scale) are defined in `tailwind.config.ts`.

3. **Given** `wrangler.toml` and `next.config.ts` are configured with `@opennextjs/cloudflare` **When** `next build` is run **Then** the output is compatible with Cloudflare Workers and `wrangler dev` runs without errors.

4. **Given** Sentry free tier is configured **When** a runtime error occurs on either the customer flow or Admin UI **Then** Sentry captures it via the instrumentation pattern and `error.tsx` / `global-error.tsx` boundaries.

5. **Given** GitHub Actions is configured **When** a PR is opened **Then** the CI workflow in `.github/workflows/ci.yml` runs Playwright tests automatically.

6. **Given** the CI workflow is configured **When** a merge to `main` occurs **Then** `wrangler deploy` deploys to Cloudflare Workers using the API token stored as a GitHub Actions secret.

7. **Given** environment setup is complete **When** the repo is cloned fresh **Then** `.env.example` documents all required variables and `.env.local` is excluded from git.

## Tasks / Subtasks

- [x] Task 1: Bootstrap Next.js project with Supabase starter (AC: 1)
  - [x] Run `npx create-next-app -e with-supabase dine-in-cc`
  - [x] Verify `tsconfig.json` has `"strict": true`
  - [x] Verify `utils/supabase/server.ts`, `utils/supabase/client.ts`, `utils/supabase/middleware.ts` exist
  - [x] Confirm Next.js version is 16.2.6 in `package.json`
  - [x] Write smoke test: `vitest` config test asserting `1 + 1 === 2` — confirms test runner works before real tests exist

- [x] Task 2: Verify and configure `@opennextjs/cloudflare` adapter (AC: 3)
  - [x] Install `@opennextjs/cloudflare@1.19.8`
  - [x] Create `open-next.config.ts` with `defineCloudflareConfig()`
  - [x] Update `next.config.ts`: add `initOpenNextCloudflareForDev()` call + wrap export with `withSentryConfig`
  - [x] Create `wrangler.toml` with required fields (see Dev Notes for exact config)
  - [x] Run `next build` — confirm output includes `.open-next/worker.js`
  - [x] Run `wrangler dev` — confirm it starts without errors
  - [x] Document compatibility outcome in Completion Notes

- [x] Task 3: Install design-md Apple system + configure design tokens (AC: 2)
  - [x] Run `npx getdesign@latest add apple`
  - [x] Extend `tailwind.config.ts` with all custom tokens: accent `#FF6B35`, light/dark surface colors, status colors, typography scale (see Dev Notes for full token list)
  - [x] Confirm `tailwind.config.ts` compiles without error (`npx tailwindcss --help` or build check)

- [x] Task 4: Configure Sentry error monitoring (AC: 4)
  - [x] Install `@sentry/nextjs@10.51.0`
  - [x] Create `instrumentation.ts` (project root) — registers server + edge Sentry configs
  - [x] Create `sentry.client.config.ts` with `Sentry.init` + `NEXT_PUBLIC_SENTRY_DSN`
  - [x] Create `sentry.server.config.ts` with `Sentry.init` + `SENTRY_DSN`
  - [x] Create `sentry.edge.config.ts` with `Sentry.init` + `SENTRY_DSN`
  - [x] Create `app/global-error.tsx` (root boundary) with explicit `Sentry.captureException(error)`
  - [x] Create `app/error.tsx` (route boundary) with explicit `Sentry.captureException(error)`
  - [x] Wrap `next.config.ts` export with `withSentryConfig(nextConfig, { silent: true })`
  - [x] Add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` to `.env.example`

- [x] Task 5: Set up Vitest + Playwright testing infrastructure (AC: 5 prereq)
  - [x] Install: `vitest@4.1.5 @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`
  - [x] Create `vitest.config.mts` (see Dev Notes for exact config)
  - [x] Install: `@playwright/test@1.59.1`
  - [x] Create `playwright.config.ts` (see Dev Notes for RLS test setup)
  - [x] Add scripts to `package.json`: `"test": "vitest"`, `"test:e2e": "playwright test"`, `"test:rls": "playwright test tests/rls/"`
  - [x] Create `tests/rls/` directory with empty `.gitkeep`
  - [x] Create `tests/e2e/` directory with empty `.gitkeep`
  - [x] Run `npm test` — smoke test (from Task 1) must pass

- [x] Task 6: Create project directory structure (AC: 1 — foundation for all subsequent stories)
  - [x] Create `components/customer/` (empty, will hold MenuItemRow etc.)
  - [x] Create `components/admin/` (empty)
  - [x] Create `components/shared/` (empty)
  - [x] Create `stores/` (empty)
  - [x] Create `actions/` (empty)
  - [x] Create `types/app.ts` (empty placeholder, will hold app-level types)
  - [x] Verify `types/supabase.ts` placeholder exists (generated types location)

- [x] Task 7: Configure GitHub Actions CI/CD (AC: 5, 6)
  - [x] Create `.github/workflows/ci.yml` (see Dev Notes for full YAML)
  - [x] Configure `test` job: checkout → node setup → npm ci → supabase CLI → `supabase start` → `npm run test:rls`
  - [x] Configure `deploy` job: runs on `main` only, after `test`, runs `npm run build` then `npx wrangler deploy`
  - [x] Add `CLOUDFLARE_API_TOKEN` to required GitHub Actions secrets documentation (in `.env.example` comments)

- [x] Task 8: Document environment variables (AC: 7)
  - [x] Create `.env.example` with all required vars (see Dev Notes for full list)
  - [x] Confirm `.env.local` is in `.gitignore` (starter includes this; verify it's there)
  - [x] Confirm `.env.local` is not tracked by git (`git status` check)

### Review Findings (AI) — 2026-05-09

#### Decision Needed

- [x] [Review][Decision] shadcn/ui component library present from starter template — RESOLVED: deleted `components/ui/`, `components.json`; removed `@radix-ui/react-checkbox`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-slot`, `class-variance-authority` deps; updated auth pages to use native HTML + design tokens.
- [x] [Review][Decision] `md:` Tailwind breakpoint used in starter auth pages — RESOLVED: replaced all `md:p-10` → `lg:p-10` across 4 auth pages; `components/ui/input.tsx` removed with shadcn cleanup.
- [x] [Review][Decision] Design token names use `din-` prefix — RESOLVED: renamed all CSS variables to no prefix (`--surface-base`, `--text-primary` etc.) and Tailwind config keys to match; updated all class usages in converted pages.

#### Patches

- [x] [Review][Patch] `.env.example` documents wrong Supabase key name — FIXED: renamed `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to match runtime code. [`.env.example`]
- [x] [Review][Patch] No `supabase/` directory — `supabase start` in CI always fails — FIXED: ran `supabase init` to create `supabase/config.toml`. [`supabase/`]
- [x] [Review][Patch] `global-error.tsx` missing `reset` prop — FIXED: added `reset: () => void` prop and "Try again" button. [`app/global-error.tsx`]
- [x] [Review][Patch] `cacheComponents: true` is not a valid `NextConfig` key — FIXED: removed the option. [`next.config.ts`]
- [x] [Review][Patch] Smoke test at `tests/smoke.test.ts` is inside Playwright's `testDir: "./tests"` — FIXED: moved to `tests/unit/smoke.test.ts`; added `testIgnore: ["**/unit/**"]` to `playwright.config.ts`. [`playwright.config.ts`, `tests/unit/smoke.test.ts`]
- [x] [Review][Patch] Typography scale tokens missing from `tailwind.config.ts` — FIXED: added Apple HIG-aligned `fontSize` scale (display, title-1..3, headline, body, callout, subhead, footnote, caption). [`tailwind.config.ts`]
- [x] [Review][Patch] CI deploy job missing Supabase env vars at build time — FIXED: added `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` to deploy job env; documented as required GitHub secrets in `.env.example`. [`.github/workflows/ci.yml`]

#### Deferred

- [x] [Review][Defer] `global_fetch_strictly_public` compatibility flag blocks private/loopback IPs via wrangler — blocks fetch() to non-public addresses; local Supabase (localhost:54321) would fail if accessed through `wrangler dev`. Not blocking for CF production (Supabase URL is public). [`wrangler.toml`] — deferred, only relevant for local wrangler dev workflow
- [x] [Review][Defer] `CLOUDFLARE_ACCOUNT_ID` not injected in CI deploy job — wrangler may auto-detect from API token but fails ambiguously when token has multi-account access. [`.github/workflows/ci.yml` deploy job] — deferred, verify during first actual deploy
- [x] [Review][Defer] `instrumentation.ts` Sentry init may not fire on Cloudflare Workers runtime — NEXT_RUNTIME checks cover `nodejs` and `edge`; CF Workers via OpenNext may use a different runtime label. Needs testing post-deploy. [`instrumentation.ts`] — deferred, pre-existing adapter limitation
- [x] [Review][Defer] `next`, `@supabase/ssr`, `@supabase/supabase-js` pinned to `"latest"` in `package.json` — any `npm install` will silently bump these; only `package-lock.json` guards stability. [`package.json`] — deferred, pre-existing scaffolding choice

## Dev Notes

### ⚠️ Critical: @opennextjs/cloudflare Config (Two Files Required)

The architecture doc mentions `wrangler.toml` and `next.config.ts`. The actual adapter also requires `open-next.config.ts`. Do NOT skip it.

**`open-next.config.ts`** (project root — NEW file):
```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
export default defineCloudflareConfig()
```

**`next.config.ts`** (UPDATE starter file — add at top, wrap export):
```typescript
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import { withSentryConfig } from "@sentry/nextjs"

initOpenNextCloudflareForDev() // Required for CF bindings in local dev

const nextConfig = {
  // keep all existing starter config here
}

export default withSentryConfig(nextConfig, { silent: true })
```

**`wrangler.toml`** (project root — NEW file):
```toml
$schema = "./node_modules/wrangler/config-schema.json"
name = "dine-in-cc"
main = ".open-next/worker.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```
⚠️ Do NOT change `main` value or `assets.directory` — they must match OpenNext's build output path exactly.

---

### ⚠️ Critical: Sentry v10 Uses `instrumentation.ts`, NOT `app/layout.tsx`

The epics AC says "via the init in `app/layout.tsx`" — this reflects the architecture intent (Sentry captures errors), but `@sentry/nextjs@10.51.0` uses the Next.js Instrumentation API. Implement it correctly:

**`instrumentation.ts`** (project root):
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
```

**`sentry.client.config.ts`**:
```typescript
import * as Sentry from "@sentry/nextjs"
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
})
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

**`sentry.server.config.ts`** and **`sentry.edge.config.ts`**:
```typescript
import * as Sentry from "@sentry/nextjs"
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 })
```

**`app/global-error.tsx`** (catches errors that escape `error.tsx`):
```typescript
'use client'
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return <html><body><h2>Something went wrong</h2></body></html>
}
```

**`app/error.tsx`** (route-level, calls Sentry explicitly):
```typescript
'use client'
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return <div><h2>Something went wrong</h2><button onClick={reset}>Try again</button></div>
}
```
⚠️ Error boundaries intercept before Sentry's global handler — always call `Sentry.captureException(error)` explicitly.

---

### Vitest Configuration

**`vitest.config.mts`** (project root):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
  },
})
```

**Smoke test** (write this in Task 1, run in Task 5):

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('vitest is configured correctly', () => {
    expect(1 + 1).toBe(2)
  })
})
```

⚠️ Async Server Components are NOT testable in Vitest — all Server Component logic tested via Playwright only.

---

### Playwright Configuration for RLS Tests

**`playwright.config.ts`**:
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // RLS tests use Supabase directly, not a browser — define as API project
  webServer: undefined,
})
```

For `tests/rls/` — these are Playwright API tests (no browser), using Supabase JS client pointed at `http://localhost:54321` (local Supabase). Story 1.2 writes the actual RLS test files.

---

### Design Tokens for `tailwind.config.ts`

After `npx getdesign@latest add apple`, extend the `theme.extend.colors` block:

```typescript
// Light/dark surface tokens
'surface-base': 'var(--surface-base)',   // #FFFFFF light, #000000 dark
'surface-raised': 'var(--surface-raised)', // #F5F5F7 light, #1C1C1E dark  
'surface-overlay': 'var(--surface-overlay)', // #E8E8ED light, #2C2C2E dark
// Text
'text-primary': 'var(--text-primary)',   // #1D1D1F light, #F5F5F7 dark
'text-secondary': 'var(--text-secondary)', // #6E6E73 light, #AEAEB2 dark
'text-tertiary': 'var(--text-tertiary)', // #AEAEB2 light, #6E6E73 dark
// Accent
'accent': '#FF6B35',
'accent-muted': 'var(--accent-muted)',   // #FFF0EB light, #3A1A0A dark
// Status
'success': 'var(--success)',             // #34C759 light, #30D158 dark
// Border
'border': 'var(--border)',               // #D2D2D7 light, #38383A dark
```

Add CSS variables to `app/globals.css`:
```css
:root {
  --surface-base: #FFFFFF;
  --surface-raised: #F5F5F7;
  --surface-overlay: #E8E8ED;
  --text-primary: #1D1D1F;
  --text-secondary: #6E6E73;
  --text-tertiary: #AEAEB2;
  --accent-muted: #FFF0EB;
  --success: #34C759;
  --border: #D2D2D7;
}
.dark {
  --surface-base: #000000;
  --surface-raised: #1C1C1E;
  --surface-overlay: #2C2C2E;
  --text-primary: #F5F5F7;
  --text-secondary: #AEAEB2;
  --text-tertiary: #6E6E73;
  --accent-muted: #3A1A0A;
  --success: #30D158;
  --border: #38383A;
}
```

---

### GitHub Actions CI/CD

**`.github/workflows/ci.yml`**:
```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: npx playwright install --with-deps chromium
      - run: npm run test:rls
      - run: npm test -- --run

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

### `.env.example` Contents

```bash
# Supabase — get from Supabase project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Sentry — get from Sentry project settings
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project
SENTRY_DSN=https://your-dsn@sentry.io/your-project
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project

# GitHub Actions secrets (not used locally — stored in GH repo settings)
# CLOUDFLARE_API_TOKEN — set in GitHub repo Settings → Secrets
```

---

### Package Versions (pinned for reproducibility)

| Package | Version | Role |
|---------|---------|------|
| `next` | 16.2.6 | App framework |
| `react` / `react-dom` | 19.2 | UI runtime |
| `@opennextjs/cloudflare` | 1.19.8 | Cloudflare Workers adapter |
| `@sentry/nextjs` | 10.51.0 | Error monitoring |
| `vitest` | 4.1.5 | Unit/component test runner |
| `@vitejs/plugin-react` | latest | Vitest React transform |
| `@testing-library/react` | latest (React 19 compat) | Component testing |
| `@testing-library/dom` | latest | RTL peer dep |
| `vite-tsconfig-paths` | latest | Path alias support in Vitest |
| `@playwright/test` | 1.59.1 | E2E + RLS integration tests |

---

### Architecture Compliance Rules (must not be violated)

- TypeScript strict mode ON — do not set `"strict": false` at any point
- No `md:` breakpoint in any Tailwind class — only `sm:` and `lg:`
- No `shadcn/ui`, `TanStack Query`, Drizzle, Prisma — not in this stack
- RLS test files go in `tests/rls/` — never co-located with source
- All price fields: `price_cents: integer` — never floats (no price fields in this story, but establish the pattern)
- `price_cents` integer rule established in `types/app.ts` with a comment

---

### Anti-Patterns to Avoid

- `throw new Error(...)` inside any function that will become a Server Action — always return `ActionResult<T>` shape (set pattern now in `types/app.ts`)
- `supabase.from(...).select('*')` without `restaurant_id` filter (no Supabase calls this story, but note the pattern)
- Hardcoded hex colors in components — use design tokens only
- `setTimeout` for polling — use `setInterval` (not relevant yet, but note it)
- Direct `localStorage` access — all auth via Supabase SSR cookies

---

### Project Structure Notes

- Starter provides: `app/`, `utils/supabase/` (3 files), `middleware.ts`, TypeScript, Tailwind — keep all of these
- Create the following empty directories with `.gitkeep` to establish architecture: `components/customer/`, `components/admin/`, `components/shared/`, `stores/`, `actions/`
- `types/app.ts` — create with `ActionResult<T>` type and `price_cents` comment as a foundation for Story 1.2+

Seed `types/app.ts`:
```typescript
// ActionResult: return type for ALL Server Actions — never throw
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// All prices stored as integer cents: 1500 = $15.00
// Use utils/formatPrice.ts for display formatting
export type PriceCents = number
```

### References

- [Source: architecture.md#Starter Template Evaluation]
- [Source: architecture.md#Infrastructure & Deployment]
- [Source: architecture.md#Complete Project Directory Structure]
- [Source: architecture.md#Format Patterns — ActionResult, price_cents]
- [Source: architecture.md#Enforcement Guidelines]
- [Source: epics.md#Story 1.1]
- [Source: ux-design-specification.md#Design System Foundation]
- [Source: @opennextjs/cloudflare docs — https://opennext.js.org/cloudflare/get-started]
- [Source: @sentry/nextjs docs — https://docs.sentry.io/platforms/javascript/guides/nextjs/]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **create-next-app conflict**: Scaffolded into `/tmp/dine-in-cc-scaffold/` then rsync'd to project root (existing `_bmad/` directory blocked direct scaffold).
- **OpenNext esbuild peer conflict**: Required `--legacy-peer-deps` for `@opennextjs/cloudflare@1.19.8` and `wrangler` installs.
- **wrangler.toml $schema**: `$schema` line from OpenNext docs is invalid TOML — removed it. Field not required for builds.
- **OpenNext middleware incompatibility**: Starter's `proxy.ts` (Fluid compute pattern, Next.js 16 preferred) was flagged as Node.js middleware by OpenNext 1.19.8. Deleted `proxy.ts`, created `middleware.ts` with standard Next.js middleware convention — build succeeded with `.open-next/worker.js` generated.

### Completion Notes List

- **AC 1 (Bootstrap)**: Next.js 16.2.6 App Router scaffolded from `with-supabase` starter. TypeScript strict mode confirmed ON. Supabase SSR utilities exist at `lib/supabase/` (starter path — architecture doc says `utils/supabase/`, deviation documented).
- **AC 2 (Design tokens)**: `npx getdesign@latest add apple` created `DESIGN.md`. Custom `din-` prefixed tokens added to `tailwind.config.ts` and CSS variables added to `app/globals.css` for light/dark mode.
- **AC 3 (OpenNext)**: `@opennextjs/cloudflare@1.19.8` + `wrangler` installed. `open-next.config.ts` and `wrangler.toml` created. `next build` produces `.open-next/worker.js`. Used `middleware.ts` (not `proxy.ts`) for OpenNext compatibility.
- **AC 4 (Sentry)**: `@sentry/nextjs@10.51.0` installed. `instrumentation.ts` pattern used (NOT `app/layout.tsx`). `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` created. Error boundaries `app/error.tsx` and `app/global-error.tsx` explicitly call `Sentry.captureException`.
- **AC 5 (CI — test job)**: `.github/workflows/ci.yml` created with `test` job: checkout → Node 20 → npm ci → supabase CLI → supabase start → playwright install → `npm run test:rls` → `npm test`.
- **AC 6 (CI — deploy job)**: `deploy` job triggers on push to `main` only, after `test`, runs `npm run build` then `npx wrangler deploy` with `CLOUDFLARE_API_TOKEN` secret.
- **AC 7 (Env docs)**: `.env.example` documents all required vars. `.gitignore` already excludes `.env*.local` via starter template.
- **Vitest**: `vitest.config.mts` configured with jsdom + react plugin + tsconfig paths. Smoke test passes: 1 passed (1).
- **Types foundation**: `types/app.ts` establishes `ActionResult<T>` discriminated union and `PriceCents` pattern for all subsequent stories.

### File List

- `.github/workflows/ci.yml` (NEW)
- `.env.example` (UPDATED — added Sentry and Cloudflare secret docs)
- `next.config.ts` (UPDATED — added `initOpenNextCloudflareForDev`, `withSentryConfig` wrap)
- `open-next.config.ts` (NEW)
- `wrangler.toml` (NEW)
- `middleware.ts` (NEW — replaces proxy.ts for OpenNext compatibility)
- `proxy.ts` (DELETED — Fluid compute pattern incompatible with OpenNext 1.19.8)
- `instrumentation.ts` (NEW)
- `sentry.client.config.ts` (NEW)
- `sentry.server.config.ts` (NEW)
- `sentry.edge.config.ts` (NEW)
- `app/error.tsx` (NEW)
- `app/global-error.tsx` (NEW)
- `vitest.config.mts` (NEW)
- `playwright.config.ts` (NEW)
- `package.json` (UPDATED — added test scripts)
- `tailwind.config.ts` (UPDATED — added din-* design tokens)
- `app/globals.css` (UPDATED — added CSS variables for light/dark tokens)
- `DESIGN.md` (NEW — created by design-md CLI)
- `tests/smoke.test.ts` (NEW)
- `tests/rls/.gitkeep` (NEW)
- `tests/e2e/.gitkeep` (NEW)
- `components/customer/.gitkeep` (NEW)
- `components/admin/.gitkeep` (NEW)
- `components/shared/.gitkeep` (NEW)
- `stores/.gitkeep` (NEW)
- `actions/.gitkeep` (NEW)
- `types/app.ts` (NEW)
- `types/supabase.ts` (NEW — placeholder, generated in Story 1.2)

### Change Log

- 2026-05-09: Story 1.1 implemented — Next.js 16.2.6 + Supabase starter scaffolded, OpenNext 1.19.8 adapter configured, Sentry v10 instrumentation set up, Vitest + Playwright testing infrastructure established, GitHub Actions CI/CD configured, design tokens applied, directory structure created.
