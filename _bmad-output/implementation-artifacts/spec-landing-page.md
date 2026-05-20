---
title: 'Public landing page for restaurant-owner acquisition'
type: 'feature'
created: '2026-05-20'
status: 'done'
baseline_commit: '22ed59c'
context:
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/prd.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The root path (`/`) currently renders the Next.js + Supabase starter boilerplate — logos, "Powered by Supabase" footer, tutorial "Next steps" — making the deployed app look unfinished and giving no acquisition surface for restaurant owners (Marco persona). Diners arrive via QR code, so the landing page only needs to convert owners.

**Approach:** Replace `app/page.tsx` with a single-page marketing layout targeting restaurant owners — hero, features, how-it-works, pricing teaser, footer. Authenticated owners are redirected to `/admin` server-side before render. Existing auth, theme switching, and design tokens are reused; no new dependencies.

## Boundaries & Constraints

**Always:**
- Server Component for the page; auth check via `getClaims()` and `redirect('/admin')` for logged-in owners
- Use Tailwind only, design-md tokens (no hardcoded hex colors); responsive at `sm` and `lg`
- Primary CTAs link to `/auth/sign-up`; secondary "Sign in" to `/auth/login`
- Keep the existing `ThemeSwitcher` in the nav and footer area
- Copy speaks to restaurant owners (not diners); the only diner mention is a short footer note: "Are you a diner? Scan the QR code on your table."

**Ask First:**
- Any concrete pricing number — PRD only specifies "single tier, flat monthly billing" with no figure. Pricing section must use a teaser ("Simple flat monthly pricing — contact us for early-access rates") + sign-up CTA, never an invented number.
- Adding any new npm dependency
- Removing the starter components (`components/deploy-button.tsx`, `components/hero.tsx`, `components/next-logo.tsx`, `components/supabase-logo.tsx`, `components/env-var-warning.tsx`, `components/tutorial/*`) — leave them in place (just unused) for this spec; cleanup belongs to a separate chore.

**Never:**
- No customer-facing menu/order content on this page (customers come via QR, not via root)
- No invented pricing tiers, no fake testimonials, no fake logos
- No `'use client'` on the page itself (sections that need interactivity can be Client Component children — none currently needed)
- No new analytics scripts or third-party embeds
- No payment integration, signup-form embedding, or video — Quick Dev scope

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unauthenticated visitor | No Supabase session cookie | Renders landing page; "Get started" → `/auth/sign-up`, "Sign in" → `/auth/login` | N/A |
| Authenticated owner | Valid session cookie | Server-side `redirect('/admin')` before render | N/A |
| Supabase env not configured | `hasEnvVars === false` | Renders landing page; auth nav slot shows nothing (or static "Sign in" link) — does not crash | Silent — same as starter |
| `getClaims()` returns error | Network/Supabase error | Treat as unauthenticated; render landing page | Log via `console.error`; do not throw |

</frozen-after-approval>

## Code Map

- `app/page.tsx` -- rewrite: server-component landing page; auth gate + section composition
- `components/marketing/LandingNav.tsx` -- NEW: sticky top nav with brand, sign-in/sign-up, theme switcher
- `components/marketing/LandingHero.tsx` -- NEW: above-the-fold headline, sub-headline, primary CTA
- `components/marketing/LandingFeatures.tsx` -- NEW: 3-feature grid (Menu builder / QR per table / Real-time orders)
- `components/marketing/LandingHowItWorks.tsx` -- NEW: 3-step explainer (Sign up → Build menu → Print QR)
- `components/marketing/LandingPricing.tsx` -- NEW: pricing teaser card with sign-up CTA
- `components/marketing/LandingFooter.tsx` -- NEW: footer with diner note, theme switcher, copyright
- `lib/supabase/server.ts` -- read-only: import `createClient` for auth check
- `components/theme-switcher.tsx` -- read-only: reuse in nav and footer
- `tests/unit/marketing/LandingPage.test.tsx` -- NEW: vitest test covering unauth render + auth redirect behavior via mocked `createClient`

## Tasks & Acceptance

**Execution:**
- [x] `components/marketing/LandingNav.tsx` -- create the sticky nav (brand text "dine-in-cc", `Sign in` link, `Get started` CTA, `ThemeSwitcher`) -- shared across the page header
- [x] `components/marketing/LandingHero.tsx` -- create hero (h1 headline, sub-headline, primary "Get started — free" CTA → `/auth/sign-up`) -- conversion above the fold
- [x] `components/marketing/LandingFeatures.tsx` -- create 3-card feature grid with `lucide-react` icons (e.g., `Utensils`, `QrCode`, `Zap`) -- communicates product capability
- [x] `components/marketing/LandingHowItWorks.tsx` -- create numbered 3-step explainer (Sign up your restaurant → Build your menu → Print QR codes for tables) -- reduces perceived complexity
- [x] `components/marketing/LandingPricing.tsx` -- create pricing teaser card (no specific price; "Simple flat monthly pricing" + sign-up CTA) -- gives a pricing section without inventing numbers
- [x] `components/marketing/LandingFooter.tsx` -- create footer (diner note, theme switcher, copyright year) -- closes the page; preserves theme control
- [x] `app/page.tsx` -- rewrite as async Server Component: call `createClient()` + `getClaims()`; if authenticated owner, `redirect('/admin')`; otherwise render `<LandingNav/>`, `<LandingHero/>`, `<LandingFeatures/>`, `<LandingHowItWorks/>`, `<LandingPricing/>`, `<LandingFooter/>` -- entry point
- [x] `tests/unit/marketing/LandingPage.test.tsx` -- unit test the page with `vi.mock('@/lib/supabase/server')` — assert unauth path renders landing copy and auth path triggers `redirect('/admin')` (mock `next/navigation`) -- prevent regressions on the auth gate

**Acceptance Criteria:**
- Given an unauthenticated visitor, when they request `/`, then the landing page renders with hero headline, features grid, how-it-works, pricing teaser, and footer
- Given an authenticated owner, when they request `/`, then they are server-side redirected to `/admin` (no flash of landing content)
- Given the landing page, when a user clicks the primary CTA, then they navigate to `/auth/sign-up`
- Given the landing page, when viewed at `sm` and `lg` breakpoints, then the layout is responsive with no horizontal scroll
- Given the landing page, when the theme toggle is used, then the page respects dark and light mode via existing `next-themes` setup

## Design Notes

**Brand voice:** Direct, operator-focused. Avoid "powered by AI", "revolutionary". Match the project's existing admin UI tone (utilitarian, clear).

**Headline draft (not frozen):** "QR-code dine-in ordering that just works."
**Sub-headline draft:** "Put a code on every table. Take orders the moment your guest is ready."

**Auth-check pattern (mirror `components/auth-button.tsx`):**
```tsx
const supabase = await createClient()
const { data } = await supabase.auth.getClaims()
if (data?.claims) redirect('/admin')
```

**Diner note (footer copy):** "Are you a diner? Scan the QR code on your table."

**No new directory category in `components/`:** project-context.md lists `customer/`, `admin/`, `shared/`. Adding `components/marketing/` is justified — these components are public-facing marketing, not part of either authenticated surface.

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errors, 0 warnings
- `npm run test -- tests/unit/marketing` -- expected: all tests pass
- `npm run build` -- expected: completes successfully; no type errors

**Manual checks:**
- Visit `http://localhost:3000/` while signed out → landing renders, CTA links correct
- Visit `http://localhost:3000/` while signed in as an owner → immediate redirect to `/admin`
- Toggle theme on landing page → dark/light mode switches; no FOUC
- Resize browser to mobile (`sm`) and desktop (`lg`) → no horizontal scroll, layout reflows cleanly

## Suggested Review Order

**Auth gate (start here — design intent lives in 11 lines)**

- Server-side redirect for owners; silent fallback to landing on env-missing or auth-error
  [`page.tsx:12`](../../app/page.tsx#L12)

- Tab metadata updated from starter to dine-in-cc brand + tagline
  [`layout.tsx:10`](../../app/layout.tsx#L10)

**Page composition**

- Section ordering matches the spec's "Full marketing" scope choice
  [`page.tsx:24`](../../app/page.tsx#L24)

**Conversion surfaces (primary CTAs → /auth/sign-up)**

- Hero headline + primary CTA above the fold; line break via `<br />` is deliberate
  [`LandingHero.tsx:7`](../../components/marketing/LandingHero.tsx#L7)

- Sticky nav with brand, sign-in, get-started, theme switcher
  [`LandingNav.tsx:7`](../../components/marketing/LandingNav.tsx#L7)

- Pricing teaser — no invented numbers, sign-up CTA closes the loop
  [`LandingPricing.tsx:14`](../../components/marketing/LandingPricing.tsx#L14)

**Content sections (data-driven, server-rendered)**

- Three feature cards driven by a const array; lucide icons + design-md tokens only
  [`LandingFeatures.tsx:3`](../../components/marketing/LandingFeatures.tsx#L3)

- Numbered 3-step explainer in an ordered list
  [`LandingHowItWorks.tsx:1`](../../components/marketing/LandingHowItWorks.tsx#L1)

- Footer: diner-redirect note + theme switcher + dynamic copyright year
  [`LandingFooter.tsx:4`](../../components/marketing/LandingFooter.tsx#L4)

**Verification**

- Four tests: unauth render, CTA target, auth redirect, auth-error fallback
  [`LandingPage.test.tsx:35`](../../tests/unit/marketing/LandingPage.test.tsx#L35)
