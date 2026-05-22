# Story 10.2: Customer Language Selection & Rendering

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a dine-in customer,
I want the menu to appear in my preferred language without extra taps,
so that I can order confidently in a language I read fluently.

## Acceptance Criteria

1. **Given** a customer scans a QR code and lands on `/{restaurant_slug}/{table_number}` (or `/cart`, or `/order/{order_id}`)
   **When** the SSR render resolves the active language
   **Then** the resolution follows this priority chain (first match wins):
   1. `?lang=<code>` URL search param, if the value is in `restaurants.supported_languages`
   2. `restaurants.default_language` — the owner-set default is the source of truth for QR scans
   3. Final safety net: `'en'` (only reachable if `default_language` is somehow malformed, which the 10.1 CHECK constraint prevents)
   **And** the resolved language code is exposed to Client Components as a prop named `lang` (string)
   **And** the resolved language code is reflected on `<html lang="...">` so screen readers and the browser see the correct value (see Dev Notes: "Setting `<html lang>` from a customer route" for the implementation approach + its SSR caveat)
   **And** `Accept-Language` is intentionally **NOT** consulted. **This is a deliberate divergence from the original draft of AC#1 and from PRD FR56** ("Customer's preferred language is auto-detected from `Accept-Language` header"). Rationale: during initial testing, the auto-detect behavior surprised the owner — they set `default_language = 'en'` but their Japanese-locale browser kept seeing the menu in Japanese. The owner mental model is that the default they set IS what most customers see; Accept-Language auto-detection contradicts that intent. Customers can still switch to any supported language manually via the `<LanguageSwitcher>`. If PRD FR56 needs to be honored in the future (e.g. for international markets), the resolver can layer Accept-Language back in between URL and default with a new product decision.

2. **Given** the SSR resolution above
   **When** the resolved language equals `restaurants.default_language`
   **Then** no `?lang=` search param is added to the URL — URLs stay clean for the default-case so QR scans and bookmarks remain unchanged
   **And** when the resolved language is NOT the default, the `?lang=<code>` param is part of every customer-facing URL produced by the menu, the cart, and the order confirmation (so navigation between them carries the selection without storing it client-side)

3. **Given** the customer is on the menu page
   **When** the page renders **and** `restaurants.supported_languages.length > 1`
   **Then** a `<LanguageSwitcher>` is rendered in the top-right of the menu header (globe icon, `lucide-react/Globe`), as a small popover/menu that lists each enabled language with its `LANGUAGE_LABEL` value and a check mark on the current selection
   **And** when only one language is enabled (`supported_languages.length <= 1`), the switcher is **not** rendered (nothing to switch to)
   **And** selecting a different language navigates via `router.push()` with the new `?lang=<code>` (or removes it if the chosen language is the default) — this is a client-side navigation that re-fetches the Server Component tree and re-renders the menu in the new language **without losing cart state** (Zustand cart store is preserved across route transitions in the same tab)
   **And** the switcher is keyboard-accessible: opens with Enter/Space, closes with Escape, options are reachable with arrow keys

4. **Given** a `MenuItem` row renders on the menu page or in the `ItemConfigSheet`
   **When** the resolved `lang` is `L`
   **Then** the displayed name is `item.translations[L]?.name ?? item.name` (default column is the fallback when the translation for `L` is missing or empty)
   **And** the displayed description is `item.translations[L]?.description ?? item.description` (same fallback rule; description is allowed to be `null` / absent in either source)
   **And** the fallback is silent — the UI must NOT render `[untranslated]`, an empty string, or any placeholder. If both the translation and the default are empty/missing, the field is simply not shown (matches existing behavior when `description` is null)
   **And** the `MenuItemRow` `aria-label` (`"${name}, ${formattedPrice}"`) uses the same resolved name

5. **Given** the customer is on the cart review screen
   **When** the cart line items render
   **Then** each line item uses the translation that was captured **at "Add to Order" time** for the active language — this means `CartItem` carries a `translations` snapshot taken from the menu item at the moment of add (so a translation deleted by the owner mid-session still renders), with the same `translations[L]?.name ?? cartItem.name` fallback rule as AC#4
   **And** switching language on the menu and then revisiting the cart re-renders the cart names in the newly-selected language **without** the user needing to re-add items — the snapshot covers all enabled languages, the active one is picked at render time
   **And** the per-variant labels (`SelectedVariant.optionName`, `groupName`) remain in the language they were captured in at add-to-cart time; **variant translation is out of scope for 10.2** (called out below; see Dev Notes)

6. **Given** the customer is on the order confirmation screen (`/order/{order_id}`)
   **When** the page renders
   **Then** item names use `order.items[i].translations?.[L]?.name ?? order.items[i].name` (same fallback chain as AC#5)
   **And** the order record stores the translations snapshot in its `items` jsonb at submit time, so a translation deleted post-order still renders correctly for the customer reviewing their own order
   **And** for orders **submitted before 10.2 lands** (which have no `translations` field on the `items` jsonb), the fallback chain degrades naturally to the stored `name` — those orders simply render in the language they were submitted in

7. **Given** any customer-facing surface (menu, ItemConfigSheet, cart, order confirmation, error states)
   **When** UI chrome strings are rendered (button labels, headings, ARIA labels, status text, error messages)
   **Then** all such strings come from a server-loaded `i18n/<lang>.json` bundle — never hard-coded in the JSX
   **And** the bundle file lives at `i18n/<lang>.json` (project root, top-level `i18n/` directory)
   **And** the bundle is loaded server-side by the customer Server Components and passed as a `chrome` prop (typed `ChromeStrings`) into each Client Component that renders chrome — no client-side bundle fetch, no dynamic import on the client
   **And** a missing key in the active bundle falls back to the **English** bundle (English is the canonical source of truth for chrome keys); a missing key in BOTH bundles results in the key string itself being rendered (visible defect, easy to spot in QA)

8. **Given** the CI build
   **When** the i18n coverage check runs (`npm run check:i18n`, wired into the `prebuild` script in `package.json`)
   **Then** the check reads `i18n/en.json` as the canonical key set, then asserts every other bundle (`es`, `fr`, `ja`, `zh`) contains **exactly** the same keys
   **And** any missing or extra keys cause the script to exit non-zero with a clear error listing the offending keys per bundle
   **And** the script is invoked automatically by `npm run build` (via `prebuild`) so deployments cannot ship a bundle with gaps

9. **Given** the customer changes the language via the switcher
   **When** the URL transition completes
   **Then** scroll position is reset to top (default Next.js client-navigation behavior is acceptable; do not preserve scroll across language change — the menu structure may be visually different in another script and re-anchoring is cleanest)
   **And** the active category tab is preserved if the underlying category sections still exist (they always do — categories are not translation-gated; only their `name` would change if categories had translations, which they don't in 10.2 — out of scope)

10. **Given** the test suite
    **When** Story 10.2 lands
    **Then** unit tests cover (in this layered order so isolation issues surface fast):
    - `resolveLanguage` utility: URL > Accept-Language > default > 'en'; rejects URL values not in `supported_languages`; handles empty / missing header; handles malformed header gracefully (no throws); BCP-47 primary-subtag fallback (`es-MX` → `es`)
    - `pickTranslation` utility: returns translation when present; falls back to default columns when translation missing or has empty `name`; handles null `description` on both sides
    - `loadI18nBundle` utility: returns parsed English bundle; merges target-lang bundle over English; missing target bundle returns English unchanged (no throw)
    - i18n coverage script: parses bundles, detects missing/extra keys, exits non-zero on gap (can be a small Vitest test that imports the script's pure-functions, or a `*.test.ts` over the bundles themselves to assert key equality at test time)
    - `LanguageSwitcher` component: renders one option per enabled language; current selection has visual mark; click navigates with new `?lang=`; default-language click navigates without `?lang=`; keyboard nav (Enter/Space/Escape/arrows); hidden when `supported_languages.length <= 1`
    - `MenuItemRow`: name uses translation when present; falls back to `item.name` when translation absent; same for description
    - `ItemConfigSheet`: same rule for name and description; "Add to Order" string comes from chrome bundle
    - `CartBar`: "Review Order" + plural item count come from chrome bundle; CartBar's nav-to-cart preserves `?lang=` query string when non-default
    - `CartPage` (the new client island): all chrome strings from bundle; line item names use translation
    - `OrderConfirmationScreen`: HEADLINE / SUBHEAD / PILL_LABEL come from chrome bundle, keyed per `OrderStatus`; item names use stored `translations` snapshot with fallback to `name`
    - `submitOrder`: the inserted `orders.items` jsonb carries the `translations` snapshot from each cart item
    **And** existing unit tests for these components are updated (not deleted) — every render of a touched Client Component now requires `lang` + `chrome` props; add a small `tests/unit/customer/_fixtures/chromeFixture.ts` helper that returns a minimal `ChromeStrings` object so tests stay concise
    **And** all existing tests continue to pass after the type changes propagate

11. **Given** the resolved language is one that the test runner / SSR cannot validate end-to-end
    **When** Story 10.2 lands
    **Then** a manual smoke test confirms the QR-scan flow in each of the five languages with at least Spanish translations populated on one menu item (covers AC#4 fallback for the other languages); see Task 9 below

---

## Tasks / Subtasks

- [x] **Task 1 — Add `lang` + `chrome` prop plumbing to types** (AC: #7)
  - [x] Add to `types/app.ts`:
    ```ts
    export type ChromeStrings = Record<string, string>
    ```
    (loose `Record<string, string>` is intentional — the chrome bundle grows over time; a strict union would force every key to be threaded as a separate prop. The CI coverage check is the safety net.)
  - [ ] Extend `CartItem` with an optional `translations` snapshot (matches the `MenuItem.translations` shape — keep the type loose, mirrors the DB shape):
    ```ts
    export interface CartItem {
      cartItemId: string
      menuItemId: string
      name: string
      price_cents: number
      selectedVariants: SelectedVariant[]
      translations?: Record<string, { name: string; description?: string }>  // NEW
    }
    ```
  - [ ] Extend `OrderItem` similarly:
    ```ts
    export interface OrderItem {
      name: string
      quantity: number
      variants: string[]
      unit_price_cents: number
      translations?: Record<string, { name: string; description?: string }>  // NEW
    }
    ```
  - [x] **DO NOT** change `MenuItem.translations` — it's already required (added in 10.1) and the customer surface reads it directly via `pickTranslation`
  - [x] **DO NOT** make `CartItem.translations` or `OrderItem.translations` required — orders/cart-items created before 10.2 lands will have no translations field; the `pickTranslation` fallback handles that case naturally

- [x] **Task 2 — Utilities: `resolveLanguage`, `pickTranslation`, `loadI18nBundle`** (AC: #1, #4, #7)
  - [ ] Create `utils/resolveLanguage.ts`:
    ```ts
    import { isAllowedLanguage, type AllowedLanguage } from '@/utils/languages'

    interface ResolveInput {
      urlLang: string | undefined            // from searchParams.lang
      acceptLanguageHeader: string | null    // from next/headers
      supportedLanguages: string[]            // from restaurants.supported_languages
      defaultLanguage: string                 // from restaurants.default_language
    }

    export function resolveLanguage({ urlLang, acceptLanguageHeader, supportedLanguages, defaultLanguage }: ResolveInput): AllowedLanguage {
      // 1. URL param (if it's in supported_languages AND a known code)
      if (urlLang && isAllowedLanguage(urlLang) && supportedLanguages.includes(urlLang)) {
        return urlLang
      }
      // 2. Accept-Language header
      const negotiated = negotiateLanguage(acceptLanguageHeader, supportedLanguages)
      if (negotiated && isAllowedLanguage(negotiated)) return negotiated
      // 3. restaurant default (with one defensive fallback)
      if (isAllowedLanguage(defaultLanguage)) return defaultLanguage
      return 'en'  // 4. absolute final safety net — should never hit in practice
    }

    export function negotiateLanguage(headerValue: string | null, supportedLanguages: string[]): string | null {
      if (!headerValue) return null
      const tags = headerValue
        .split(',')
        .map((part) => {
          const [tag, ...params] = part.trim().split(';')
          const qMatch = params.find((p) => p.trim().startsWith('q='))
          const q = qMatch ? parseFloat(qMatch.split('=')[1]) : 1
          return { tag: tag.toLowerCase(), quality: Number.isFinite(q) ? q : 0 }
        })
        .filter((t) => t.quality > 0 && t.tag)
        .sort((a, b) => b.quality - a.quality)

      for (const { tag } of tags) {
        if (supportedLanguages.includes(tag)) return tag        // exact match (e.g. 'es')
        const primary = tag.split('-')[0]
        if (supportedLanguages.includes(primary)) return primary // primary-subtag fallback (e.g. 'es-MX' → 'es')
      }
      return null
    }
    ```
  - [ ] Create `utils/pickTranslation.ts`:
    ```ts
    interface TranslatableContent {
      name: string
      description?: string | null
      translations?: Record<string, { name: string; description?: string }>
    }

    export function pickTranslation(
      content: TranslatableContent,
      lang: string,
    ): { name: string; description: string | null } {
      const t = content.translations?.[lang]
      const name = t?.name?.trim() ? t.name : content.name
      const description = t?.description?.trim()
        ? t.description
        : (content.description ?? null)
      return { name, description }
    }
    ```
    Note the deliberate use of `?.trim()` so an empty-string translation falls back to the default — owners typing then deleting still see the right thing.
  - [ ] Create `utils/loadI18nBundle.ts`:
    ```ts
    import 'server-only'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import type { ChromeStrings } from '@/types/app'
    import type { AllowedLanguage } from '@/utils/languages'

    let englishCache: ChromeStrings | null = null

    async function readBundle(lang: string): Promise<ChromeStrings | null> {
      try {
        const filePath = path.join(process.cwd(), 'i18n', `${lang}.json`)
        const raw = await fs.readFile(filePath, 'utf8')
        return JSON.parse(raw) as ChromeStrings
      } catch {
        return null
      }
    }

    export async function loadI18nBundle(lang: AllowedLanguage): Promise<ChromeStrings> {
      if (!englishCache) {
        englishCache = (await readBundle('en')) ?? {}
      }
      if (lang === 'en') return englishCache
      const target = await readBundle(lang)
      if (!target) return englishCache
      return { ...englishCache, ...target }
    }
    ```
    The English bundle is cached in module scope (read once per worker instance). Target bundle is layered on top, so missing keys fall back to English silently. **Edge runtime caveat:** Cloudflare Workers via OpenNext supports `node:fs` for static assets bundled at build time; `process.cwd()` resolves to the deployed app root. If this proves problematic on Workers, switch to a top-level static import of each bundle as JSON (`import enBundle from '@/i18n/en.json'`) — see Dev Notes for the alternative pattern. **Verify on Workers** as part of Task 9 smoke.
  - [ ] **DO NOT** introduce a runtime i18n library (`next-intl`, `react-intl`, `i18next`, etc.) — the project policy is to avoid new deps; a static JSON bundle + `pickTranslation` covers AC#4 / #7 with zero new dependencies. Adding `next-intl` would also force the `<html lang>` decision into a library-specific pattern that conflicts with the pragmatic approach below.
  - [ ] **DO NOT** import `loadI18nBundle` from a Client Component — it's `server-only` and uses `node:fs`. Client Components receive the loaded bundle via props.

- [x] **Task 3 — Create the i18n bundles** (AC: #7, #8)
  - [ ] Create `i18n/en.json` as the canonical key list. Suggested initial key set covers every chrome string in the customer surface — derive the exact list from the existing JSX while implementing Tasks 5–7, but at minimum:
    ```json
    {
      "menu.unavailable": "This menu isn't available right now. Please ask your server.",
      "menu.uncategorized": "Uncategorized",
      "menu.itemNotAvailable": "Not available right now",
      "menu.languageSwitcher": "Change language",
      "item.addToOrder": "Add to Order",
      "cart.reviewOrderTitle": "Order Review",
      "cart.addMoreItems": "← Add more items",
      "cart.remove": "Remove",
      "cart.removeAriaLabel": "Remove one {name} from cart",
      "cart.total": "Total",
      "cart.placeOrder": "Place Order",
      "cart.placingOrder": "Placing order…",
      "cart.barReviewOrder": "Review Order",
      "cart.barItemSingular": "item",
      "cart.barItemPlural": "items",
      "cart.barAriaLabel": "Cart: {count} {itemWord}, {total} — tap to review order",
      "cart.srItemsInCart": "{count} {itemWord} in cart",
      "order.unavailable": "This page isn't available right now. Please ask your server.",
      "order.headline.received": "Your order is with the kitchen",
      "order.headline.preparing": "Your food is being prepared",
      "order.headline.ready": "Your order is ready",
      "order.headline.completed": "Order completed — enjoy your meal",
      "order.subhead.received": "Thank you! Sit tight while we prepare your food.",
      "order.subhead.preparing": "The kitchen is working on it.",
      "order.subhead.ready": "Please collect your order.",
      "order.subhead.completed": "We hope to see you again soon.",
      "order.pill.received": "Confirmed",
      "order.pill.preparing": "Preparing",
      "order.pill.ready": "Ready",
      "order.pill.completed": "Completed",
      "order.tableCaption": "{restaurantName} · Table {tableNumber}"
    }
    ```
  - [ ] Create `i18n/es.json`, `i18n/fr.json`, `i18n/ja.json`, `i18n/zh.json` with the **same key list** translated. Use professional translations where the developer is fluent; otherwise use the best available reference and flag for review in the PR. **Every key in `en.json` must exist in every other bundle** — the CI gate (Task 8) enforces this.
  - [ ] The bundle is shape `Record<string, string>`. **No nested objects.** Flat keys with dot-namespaces are easier to grep, easier to diff in PRs, and avoid TypeScript indexing gymnastics. Placeholder interpolation uses `{name}` / `{count}` / etc. syntax — substitution happens at render site, no helper needed beyond `.replace(/\{(\w+)\}/g, ...)` if you write a small helper (or inline; the call sites are few).
  - [ ] Create a tiny inline substitution helper at the render site OR a one-line util `utils/formatChrome.ts`:
    ```ts
    export function formatChrome(template: string, values: Record<string, string | number>): string {
      return template.replace(/\{(\w+)\}/g, (_, k) => (values[k] !== undefined ? String(values[k]) : `{${k}}`))
    }
    ```
    Unknown placeholders render as `{name}` literal — visible defect, easy to spot.
  - [ ] **DO NOT** scatter translations inline across components — every chrome string flows through the bundle. The reviewer will reject inline string literals on the customer surface.
  - [ ] **DO NOT** put HTML / markup inside bundle values — values are plain strings; if a string needs bolding, split into multiple keys and compose in JSX (or accept that the chrome text is plain). This keeps translation simple and avoids XSS surface.

- [x] **Task 4 — Server Component plumbing on customer pages** (AC: #1, #2, #7)
  - [ ] Edit `app/[restaurant_slug]/[table_number]/page.tsx`:
    - Extend `Props` to accept `searchParams: Promise<{ lang?: string }>`. Await both `params` and `searchParams`.
    - Extend the restaurant select to include `supported_languages, default_language`:
      ```ts
      .select('id, name, slug, is_published, supported_languages, default_language')
      ```
    - Read `Accept-Language` via `import { headers } from 'next/headers'` → `(await headers()).get('accept-language')`
    - Resolve the active language via `resolveLanguage({...})`
    - Load the chrome bundle via `await loadI18nBundle(lang)`
    - Pass `lang`, `chrome`, `supportedLanguages`, `defaultLanguage` to `CustomerMenuClient` (new required props)
  - [ ] Convert `app/[restaurant_slug]/[table_number]/cart/page.tsx` from pure Client Component to a **Server Component shell** that resolves lang + bundle, then renders a new `CartPageClient` (Client Component, contains the existing cart-page logic):
    - **Why convert?** Project policy is "no client-side bundle fetch" (AC#7). Keeping the cart page as a Client Component would require either a client-side fetch of the bundle or threading the bundle through Zustand — both fight the pattern used by the menu and order pages. The Server Component shell is the consistent pattern.
    - The shell must also fetch `restaurants.supported_languages, default_language` keyed by `restaurant_slug` (to feed `resolveLanguage`); it does NOT need to fetch table or menu — those are not used on the cart page (cart contents are client-side state).
    - The shell uses the **admin client** (`createAdminClient`) — same pattern as the menu page, since this is a sessionless customer route. Read-only, no writes.
    - If the restaurant slug doesn't resolve, render an "unavailable" message (mirror `MenuUnavailable`); use chrome key `menu.unavailable`.
  - [ ] Edit `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx`:
    - Extend `searchParams: Promise<{ lang?: string }>`.
    - Extend the restaurant select to include `supported_languages, default_language` (same as menu page).
    - Resolve lang and load bundle (same as menu page).
    - Pass `lang`, `chrome`, `supportedLanguages`, `defaultLanguage` to `OrderConfirmationScreen`.
    - The order's `items` jsonb already round-trips through the existing parse step — but if the row was inserted before 10.2, `translations` will be undefined on each item; that's expected and handled by `pickTranslation` fallback.
  - [ ] **DO NOT** read `Accept-Language` inside Client Components — `next/headers` is server-only. Resolution happens server-side; the resolved `lang` flows down as a prop.
  - [ ] **DO NOT** use the server cookie client (`lib/supabase/server.ts → createClient()`) for these reads — customer routes are sessionless and use the admin client per project rules (see `_bmad-output/project-context.md`).

- [x] **Task 5 — `<LanguageSwitcher>` component + `<html lang>` patcher** (AC: #1, #3, #9)
  - [ ] Create `components/customer/LanguageSwitcher.tsx`:
    ```tsx
    'use client'
    import { useRouter, usePathname, useSearchParams } from 'next/navigation'
    import { useEffect, useRef, useState } from 'react'
    import { Globe, Check } from 'lucide-react'
    import { LANGUAGE_LABEL, type AllowedLanguage, isAllowedLanguage } from '@/utils/languages'
    import type { ChromeStrings } from '@/types/app'

    interface Props {
      lang: AllowedLanguage
      supportedLanguages: string[]
      defaultLanguage: string
      chrome: ChromeStrings
    }

    export function LanguageSwitcher({ lang, supportedLanguages, defaultLanguage, chrome }: Props) {
      const router = useRouter()
      const pathname = usePathname()
      const params = useSearchParams()
      const [open, setOpen] = useState(false)
      const buttonRef = useRef<HTMLButtonElement>(null)
      const menuRef = useRef<HTMLUListElement>(null)

      // Hide entirely when there's nothing to switch to
      const valid = supportedLanguages.filter(isAllowedLanguage)
      if (valid.length <= 1) return null

      const handleSelect = (code: AllowedLanguage) => {
        setOpen(false)
        const next = new URLSearchParams(params.toString())
        if (code === defaultLanguage) {
          next.delete('lang')
        } else {
          next.set('lang', code)
        }
        const qs = next.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname)
      }

      // Close on outside click / Escape (see component implementation)
      useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
        const onClick = (e: MouseEvent) => {
          if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onClick)
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
      }, [open])

      return (
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={chrome['menu.languageSwitcher'] ?? 'Change language'}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
          >
            <Globe className="h-5 w-5" aria-hidden="true" />
          </button>
          {open && (
            <ul
              ref={menuRef}
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-border bg-surface-raised shadow-lg"
            >
              {valid.map((code) => (
                <li key={code} role="none">
                  <button
                    role="menuitemradio"
                    aria-checked={code === lang}
                    onClick={() => handleSelect(code as AllowedLanguage)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay"
                  >
                    {LANGUAGE_LABEL[code as AllowedLanguage]}
                    {code === lang && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    ```
  - [ ] Create `components/customer/HtmlLangPatcher.tsx`:
    ```tsx
    'use client'
    import { useEffect } from 'react'
    export function HtmlLangPatcher({ lang }: { lang: string }) {
      useEffect(() => { document.documentElement.lang = lang }, [lang])
      return null
    }
    ```
    This is the pragmatic approach to AC#1's `<html lang>` requirement. See Dev Notes for the SSR caveat and the discarded alternative.
  - [ ] **DO NOT** try to set `<html lang>` from inside `app/[restaurant_slug]/[table_number]/page.tsx` — Next.js root layouts own `<html>` and child layouts cannot redeclare it without a full multiple-root-layouts refactor (which is out of scope).
  - [ ] **DO NOT** add a `<Link href="?lang=es">` switcher — `<Link>` to the same pathname with different search params triggers a full Server Component refetch correctly, BUT it does not give us the menu/Escape/keyboard semantics for a language picker. The `router.push()` approach above is cleaner.
  - [ ] **DO NOT** persist the language selection in Zustand or `localStorage` — the URL `?lang=` is the source of truth (AC#1's priority chain), and persisting elsewhere would create ambiguity (e.g. if a customer scans a new QR code, should we use their last manual selection or honor Accept-Language?). The URL-or-header design is intentionally stateless.

- [x] **Task 6 — Wire customer Client Components to consume `lang` + `chrome`** (AC: #3, #4, #5, #7)
  - [ ] `components/customer/CustomerMenuClient.tsx`:
    - Add required props: `lang: AllowedLanguage`, `chrome: ChromeStrings`, `supportedLanguages: string[]`, `defaultLanguage: string`
    - Render `<HtmlLangPatcher lang={lang} />` once at the top of the JSX tree
    - Render `<LanguageSwitcher ... />` inside the `<header>` (right-aligned) — only renders when `supportedLanguages.length > 1` (the switcher self-hides; no conditional needed here)
    - For each `MenuItemRow`, pass `lang` (and the row will pick `name`/`description` via `pickTranslation`)
    - "Uncategorized" heading: `chrome['menu.uncategorized']`
    - Pass `lang` + `chrome` into `ItemConfigSheet`
  - [ ] `components/customer/MenuItemRow.tsx`:
    - Add prop `lang: string` (and optionally `chrome: ChromeStrings` if needed for "Not available right now"; cleaner to keep chrome out of leaf components and pass that string as a prop OR pass `chrome` down).
    - At the top: `const { name, description } = pickTranslation(item, lang)`
    - Replace `item.name` → `name`, `item.description` → `description` in the JSX and aria-label
    - "Not available right now" → `chrome['menu.itemNotAvailable']` (decide: thread `chrome` prop down, OR pass that one string as a `notAvailableLabel` prop. Preferred: thread `chrome` for consistency)
  - [ ] `components/customer/ItemConfigSheet.tsx`:
    - Add props: `lang: string`, `chrome: ChromeStrings`
    - At the top of the component (when `item` is non-null): `const { name, description } = pickTranslation(item, lang)`
    - Replace usages of `item?.name` / `item?.description` → `name` / `description`
    - "Add to Order" button label and `aria-label` → `chrome['item.addToOrder']`
    - **Critical for cart:** when constructing the `cartItem` in `handleAddToOrder`, set `translations: item.translations` so the cart can re-render the item in any language:
      ```ts
      const cartItem: CartItem = {
        cartItemId: crypto.randomUUID(),
        menuItemId: item.id,
        name: item.name,         // default-column snapshot (used by old code paths / fallback)
        price_cents: getEffectivePrice(item, selectedOptions),
        selectedVariants: selectedVariantsList,
        translations: item.translations,  // NEW — full snapshot so cart can re-render in any lang
      }
      ```
  - [ ] `components/customer/CartBar.tsx`:
    - Add props: `lang: string`, `chrome: ChromeStrings`, `defaultLanguage: string`
    - Replace "Review Order" with `chrome['cart.barReviewOrder']`
    - Plural item count: `chrome['cart.barItemSingular']` / `cart.barItemPlural`
    - SR text + aria-label: use `formatChrome` to interpolate `{count}`, `{itemWord}`, `{total}`
    - When navigating to `/cart`, preserve `?lang=` if non-default:
      ```ts
      const langParam = lang === defaultLanguage ? '' : `?lang=${encodeURIComponent(lang)}`
      router.push(`/${params.restaurant_slug}/${params.table_number}/cart${langParam}`)
      ```
  - [ ] `components/customer/CategoryTabs.tsx`:
    - Add prop `chrome: ChromeStrings`
    - "Uncategorized" tab label → `chrome['menu.uncategorized']`
    - Note: category `name` itself is NOT translated in 10.2 (categories don't have a `translations` column; out of scope per epics open-questions section)
  - [ ] `components/customer/OrderConfirmationScreen.tsx`:
    - Add required props `lang: string`, `chrome: ChromeStrings`
    - Replace the four `Record<OrderStatus, string>` literals (`HEADLINE`, `SUBHEAD`, `PILL_LABEL`) at module scope with **lookups into `chrome`** at render time:
      ```tsx
      <h1 ...>{chrome[`order.headline.${status}`]}</h1>
      <p ...>{chrome[`order.subhead.${status}`]}</p>
      <span ...>{chrome[`order.pill.${status}`]}</span>
      ```
      (Module-scope `Record` literals are removed; status keys are constructed by template literal, e.g. `order.headline.preparing`.)
    - For each item in `items`, render `pickTranslation(item, lang).name` instead of `item.name` directly — items here are the `ConfirmedItem[]` shape; you'll need to either (a) widen `ConfirmedItem` to include `translations`, or (b) pass an enriched shape from the page. Preferred: widen `ConfirmedItem` to `{ name: string; quantity: number; variantNames: string[]; translations?: Record<string, {name: string; description?: string}> }`.
    - Restaurant + table caption: `formatChrome(chrome['order.tableCaption'], { restaurantName, tableNumber })`
    - `<HtmlLangPatcher lang={lang} />` at the top
  - [ ] **DO NOT** introduce a "current language" Zustand store / Context provider — the language flows top-down as a prop. A Context would feel cleaner at first but creates a second source of truth that has to be kept in sync with the URL.

- [x] **Task 7 — `submitOrder` carries translations snapshot** (AC: #5, #6)
  - [ ] Edit `actions/orderActions.ts → submitOrder`:
    - In the `map` accumulation loop (around line 68–86), include `translations` from the cart item on each accumulated row:
      ```ts
      map.set(key, {
        name: item.name,
        quantity: 1,
        variants: item.selectedVariants.map((v) => v.optionName),
        unit_price_cents: item.price_cents,
        translations: item.translations,  // NEW — pass-through snapshot
      })
      ```
    - The `existing` branch (already-seen key) needs no change — translations are identical for the same `(menuItemId, variantKey)`.
    - The `items` array is then stored as-is in `orders.items` (jsonb). No schema migration needed (jsonb accepts any shape).
  - [ ] Update the type of the local accumulator map to match:
    ```ts
    const map = new Map<string, { name: string; quantity: number; variants: string[]; unit_price_cents: number; translations?: Record<string, { name: string; description?: string }> }>()
    ```
  - [ ] In `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx`, pass `translations` through to `ConfirmedItem`:
    ```ts
    items={rawItems.map((it) => ({
      name: it.name,
      quantity: it.quantity,
      variantNames: Array.isArray(it.variants) ? it.variants : [],
      translations: it.translations,  // NEW
    }))}
    ```
  - [ ] **DO NOT** add a `menu_item_id` field to `OrderItem` — the translations snapshot at submit time means we don't need to re-fetch menu items by ID. A `menu_item_id` would also create a now-broken FK story (the menu_items row could be deleted post-order).
  - [ ] **DO NOT** strip translations from the snapshot to save bytes — the savings are negligible (≤ 5 langs × 2 fields × ~30 bytes = ~300 bytes per line item), and the alternative (re-fetch at render) is more expensive.

- [x] **Task 8 — i18n coverage CI gate** (AC: #8)
  - [ ] Create `scripts/check-i18n-coverage.mjs`:
    ```js
    #!/usr/bin/env node
    import { readFileSync, readdirSync } from 'node:fs'
    import path from 'node:path'

    const i18nDir = path.join(process.cwd(), 'i18n')
    const englishPath = path.join(i18nDir, 'en.json')
    const englishKeys = new Set(Object.keys(JSON.parse(readFileSync(englishPath, 'utf8'))))

    const bundles = readdirSync(i18nDir).filter((f) => f.endsWith('.json') && f !== 'en.json')

    let failed = false
    for (const file of bundles) {
      const data = JSON.parse(readFileSync(path.join(i18nDir, file), 'utf8'))
      const keys = new Set(Object.keys(data))
      const missing = [...englishKeys].filter((k) => !keys.has(k))
      const extra = [...keys].filter((k) => !englishKeys.has(k))
      if (missing.length || extra.length) {
        failed = true
        console.error(`[i18n] ${file}: missing ${missing.length}, extra ${extra.length}`)
        if (missing.length) console.error('  missing keys:', missing.join(', '))
        if (extra.length) console.error('  extra keys:', extra.join(', '))
      }
    }
    if (failed) { console.error('\nFAIL: i18n bundles have key mismatches.'); process.exit(1) }
    console.log(`OK: all bundles align with en.json (${englishKeys.size} keys, ${bundles.length} bundles)`)
    ```
  - [ ] In `package.json`, add:
    ```json
    "scripts": {
      ...,
      "check:i18n": "node scripts/check-i18n-coverage.mjs",
      "prebuild": "npm run check:i18n"
    }
    ```
    Now both `npm run build` and `npm run build:cf` (which runs `npm run build` first) gate on coverage. Local `npm run dev` does NOT gate (development should be allowed to iterate on bundles).
  - [ ] **DO NOT** write the coverage check as a Vitest test only — a Vitest test catches the gap only when tests run, not at every build. Both gates (Vitest + `prebuild`) are belt-and-suspenders. Pick `prebuild` as the hard gate; the Vitest test in Task 10 covers the unit-test layer.
  - [ ] **DO NOT** silently auto-fill missing keys from English at build time — the silent-fallback at runtime is acceptable (AC#7), but at build time we want an explicit failure so missing translations are caught in PR review.

- [ ] **Task 9 — Manual smoke test** (AC: #1–#11)
  - [ ] In Supabase dashboard (or via `supabase db query` locally): pick a test restaurant, set `supported_languages = ARRAY['en','es','fr']`, `default_language = 'en'`. Pick one menu item and write Spanish + French translations via the owner UI (from 10.1).
  - [ ] **Default-language scan:** open `/{slug}/{table}` with no `?lang=` — should render in the restaurant's `default_language` regardless of browser locale. The URL should remain `/{slug}/{table}` (no `?lang=`).
  - [ ] **Browser locale does NOT override default** (revised per 2026-05-22 Change Log): open the page in a browser with a non-default Accept-Language (e.g. Japanese-locale Chrome when default is English). The menu MUST render in English (default) — Accept-Language is no longer consulted by the resolver.
  - [ ] **Manual switch:** tap the globe icon → choose French → URL updates to `?lang=fr`, page re-renders with French item content and French chrome (button labels, etc.). Cart bar appears if there are items.
  - [ ] **Switch back to default:** tap the globe → choose English → URL drops the `?lang=` param, page renders in English.
  - [ ] **Fallback to default columns:** in Spanish, look at an item that has NO Spanish translation — its name/description should fall back to the default column text (not show an empty string, not show `[untranslated]`).
  - [ ] **Cart preserves selection:** add an item while in Spanish → tap "Review Order" → cart page renders with Spanish item names and Spanish chrome. URL is `/cart?lang=es`.
  - [ ] **Cart re-renders on language change:** from the cart, navigate back to menu (`← Add more items`), switch to French via switcher, tap "Review Order" again → cart now renders the same item in French.
  - [ ] **Order confirmation:** place the order while in Spanish → confirmation screen renders in Spanish, item names from the stored snapshot. Refresh the page (server re-render) — still Spanish.
  - [ ] **Cross-tenant safety:** open `/{other-slug}/{table}?lang=es` where the other restaurant does NOT have `es` enabled → resolver falls back to that restaurant's default (NOT to the URL value). URL `?lang=es` is rendered as a no-op effectively.
  - [ ] **`<html lang>`:** open browser DevTools, inspect `<html>` element — after initial render `lang` should be the resolved language. Note: the FIRST paint (pre-hydration) has `lang="en"` from the root layout; that's the documented SSR caveat.
  - [ ] **CI gate:** introduce a deliberate gap (delete one key from `i18n/es.json`), run `npm run check:i18n` → script exits non-zero with the missing key listed. Restore the key, re-run → exit 0.
  - [ ] **Cloudflare Workers compatibility check:** run `npm run build:cf` locally. The `prebuild` runs `check:i18n` first. The OpenNext build should bundle the `i18n/` JSON files into the worker assets. If the worker runtime fails to read `i18n/*.json` via `node:fs`, fall back to the alternative static-import pattern (see Dev Notes: "Edge runtime fallback for `loadI18nBundle`").

- [x] **Task 10 — Tests** (AC: #10)
  - [ ] Create `tests/unit/utils/resolveLanguage.test.ts`:
    - URL param wins when valid and in supported set
    - URL param ignored when not in supported set (falls through)
    - URL param ignored when not a known `AllowedLanguage` (e.g. `'de'`)
    - Accept-Language: exact match wins (e.g. `'es'` → `'es'`)
    - Accept-Language: primary-subtag fallback (e.g. `'es-MX'` → `'es'` when `'es'` is supported)
    - Accept-Language: highest-quality wins among multiple options (`'es;q=0.5, fr;q=0.9'` → `'fr'` if both supported)
    - Falls back to `defaultLanguage` when no match
    - Final safety net to `'en'` when defaultLanguage is malformed (defensive)
    - Empty / null header doesn't throw
    - Malformed header (`'es;q=garbage'`) doesn't throw
  - [ ] Create `tests/unit/utils/pickTranslation.test.ts`:
    - Returns translation when present
    - Falls back to `name`/`description` when translation missing
    - Falls back when translation has empty-string `name`
    - Handles `description: null` on default
    - Handles `description` missing on translation (uses default description)
    - Handles `translations` field absent entirely (CartItem / OrderItem from pre-10.2)
  - [ ] Create `tests/unit/i18n/bundles.test.ts`:
    - All bundles share the same key set as `en.json` (this is the runtime sibling of the CI gate; lets Vitest catch the issue too)
    - Every bundle's values are non-empty strings
  - [ ] Create `tests/unit/customer/LanguageSwitcher.test.tsx`:
    - Renders one option per language in `supportedLanguages`
    - Current `lang` has the check mark
    - Click on a non-default language calls `router.push(\`${pathname}?lang=<code>\`)` (mock `useRouter` + `usePathname` + `useSearchParams`)
    - Click on the default language calls `router.push(pathname)` (no `?lang=`)
    - Returns `null` when `supportedLanguages.length <= 1`
    - Pressing Escape closes the menu and refocuses the button
    - Click outside closes the menu
  - [ ] Extend `tests/unit/customer/MenuItemRow.test.tsx`:
    - Add `lang` + `chrome` props to every render call
    - Item with `translations.es.name` renders the Spanish name when `lang="es"`
    - Item without `translations.es` falls back to `item.name`
    - "Not available right now" uses `chrome['menu.itemNotAvailable']`
  - [ ] Extend `tests/unit/customer/ItemConfigSheet.test.tsx`:
    - Add `lang` + `chrome` props
    - Add-to-Order button text comes from `chrome['item.addToOrder']`
    - On Add-to-Order, the constructed `CartItem` includes `translations: item.translations`
    - Name + description honor `pickTranslation`
  - [ ] Extend `tests/unit/customer/CartBar.test.tsx`:
    - Add `lang`, `chrome`, `defaultLanguage` props
    - "Review Order" / item count / aria-label use bundle keys
    - When `lang === defaultLanguage`, nav URL has no `?lang=`
    - When `lang !== defaultLanguage`, nav URL includes `?lang=<lang>`
  - [ ] Extend `tests/unit/customer/CartPage.test.tsx` (the existing test renders the cart page directly; it now renders `CartPageClient` instead):
    - Mock the new chrome props
    - Line item names honor `pickTranslation` against `cartItem.translations`
    - All chrome strings (Total, Place Order, Add more items, Remove) come from bundle
  - [ ] Extend `tests/unit/customer/OrderConfirmationScreen.test.tsx`:
    - Add `lang` + `chrome` props
    - Headline / subhead / pill labels come from bundle keyed by status (test all four statuses)
    - Item names use translations when present; fall back when absent (`translations` field undefined on pre-10.2 orders)
    - Table caption uses `formatChrome` substitution
  - [ ] Extend or create `tests/unit/actions/orderActions.test.ts` (verify the file location; if order action tests live elsewhere, extend that location instead):
    - `submitOrder` writes `translations` into the inserted `orders.items` jsonb when cart items carry them
    - `submitOrder` writes `items` without `translations` when cart items have no translations (pre-existing behavior preserved)
  - [ ] Create `tests/unit/customer/_fixtures/chromeFixture.ts`:
    ```ts
    import type { ChromeStrings } from '@/types/app'
    export function makeChrome(overrides: Partial<ChromeStrings> = {}): ChromeStrings {
      return {
        'menu.unavailable': "Menu unavailable",
        'menu.uncategorized': 'Uncategorized',
        'menu.itemNotAvailable': 'Not available right now',
        'menu.languageSwitcher': 'Change language',
        'item.addToOrder': 'Add to Order',
        'cart.reviewOrderTitle': 'Order Review',
        'cart.addMoreItems': '← Add more items',
        'cart.remove': 'Remove',
        'cart.removeAriaLabel': 'Remove one {name} from cart',
        'cart.total': 'Total',
        'cart.placeOrder': 'Place Order',
        'cart.placingOrder': 'Placing order…',
        'cart.barReviewOrder': 'Review Order',
        'cart.barItemSingular': 'item',
        'cart.barItemPlural': 'items',
        'cart.barAriaLabel': 'Cart: {count} {itemWord}, {total} — tap to review order',
        'cart.srItemsInCart': '{count} {itemWord} in cart',
        'order.unavailable': 'Page unavailable',
        'order.headline.received': 'Your order is with the kitchen',
        'order.headline.preparing': 'Your food is being prepared',
        'order.headline.ready': 'Your order is ready',
        'order.headline.completed': 'Order completed — enjoy your meal',
        'order.subhead.received': 'Thank you!',
        'order.subhead.preparing': 'The kitchen is working on it.',
        'order.subhead.ready': 'Please collect your order.',
        'order.subhead.completed': 'See you again.',
        'order.pill.received': 'Confirmed',
        'order.pill.preparing': 'Preparing',
        'order.pill.ready': 'Ready',
        'order.pill.completed': 'Completed',
        'order.tableCaption': '{restaurantName} · Table {tableNumber}',
        ...overrides,
      }
    }
    ```
  - [ ] **MenuItem fixtures** — every existing customer-test fixture that builds a `MenuItem` already has `translations: {}` per 10.1's sweep. Verify with a quick `tsc --noEmit` after Task 1's type changes; fix any new red squiggles mechanically (just add `translations: {}` where missing).
  - [ ] **DO NOT** write E2E (Playwright) tests for 10.2 in this story — the manual smoke (Task 9) covers the end-to-end paths. An e2e suite over language flows is a follow-up.
  - [ ] **DO NOT** write RLS tests — the customer route uses the admin client (sessionless flow); RLS isn't on the read path. The reads are filtered by slug+table tuple, which the existing pattern already validates.

---

## Dev Notes

### The data flow at a glance

```
Server Component (page.tsx)
  ├─ reads URL ?lang and Accept-Language
  ├─ fetches restaurants.supported_languages, default_language
  ├─ resolveLanguage(...) → lang
  ├─ loadI18nBundle(lang) → chrome
  ├─ admin client SSR fetch (menu / order / restaurant)
  └─ passes lang + chrome + supportedLanguages + defaultLanguage → Client island

Client island (CustomerMenuClient / CartPageClient / OrderConfirmationScreen)
  ├─ <HtmlLangPatcher lang={lang} />  (sets document.documentElement.lang)
  ├─ <LanguageSwitcher ... />          (router.push with new ?lang)
  ├─ leaf components receive lang + chrome
  └─ leaf components call pickTranslation(item, lang) for item content
                  and chrome[key] for UI chrome
```

The pattern is **server-resolves-once, props-down-everywhere**. No Context, no Zustand language store. The URL is the source of truth.

### Setting `<html lang>` from a customer route

**The constraint.** Next.js App Router root layouts own the `<html>` element. Nested layouts and pages cannot redeclare it. In this project, `app/layout.tsx` is the single root layout and hardcodes `<html lang="en">`. The customer route group is nested under this layout, so it inherits `lang="en"` on initial server-rendered HTML.

**The chosen approach.** `<HtmlLangPatcher lang={lang}>` is a tiny Client Component that runs `useEffect(() => { document.documentElement.lang = lang })`. On every navigation (including language switcher clicks), it updates the attribute. This satisfies the spirit of AC#1 — screen readers and the browser see the correct `lang` for the menu content **after hydration**.

**The caveat.** The initial server-rendered HTML still has `lang="en"`. Search engines that don't execute JS will see English. For this project, that's an acceptable trade-off:
- Customer routes are deep-linked via QR codes — they're not SEO-indexed pages
- Real users have JavaScript; the patch runs within milliseconds of hydration
- Screen readers re-read the `lang` attribute on focus changes after hydration

**The discarded alternative.** A full "multiple root layouts" refactor would let us set `<html lang>` server-side. That would require: (a) deleting the existing `app/layout.tsx`, (b) moving every route into a route group (`(customer)/`, `(admin)/`, `(auth)/`, etc.) each with its own root layout, (c) duplicating `<html>`/`<body>` boilerplate per group. The blast radius is the entire `app/` directory. Out of scope for 10.2; left as a future hardening if SEO of customer pages ever becomes a goal.

### Edge runtime fallback for `loadI18nBundle`

The primary path uses `node:fs` to read `i18n/<lang>.json` at request time. OpenNext on Cloudflare Workers supports `node:fs` for assets bundled at build time, but if Task 9's smoke check finds the read fails on Workers, switch to static imports:

```ts
import enBundle from '@/i18n/en.json' assert { type: 'json' }
import esBundle from '@/i18n/es.json' assert { type: 'json' }
import frBundle from '@/i18n/fr.json' assert { type: 'json' }
import jaBundle from '@/i18n/ja.json' assert { type: 'json' }
import zhBundle from '@/i18n/zh.json' assert { type: 'json' }

const BUNDLES: Record<AllowedLanguage, ChromeStrings> = {
  en: enBundle as ChromeStrings,
  es: esBundle as ChromeStrings,
  fr: frBundle as ChromeStrings,
  ja: jaBundle as ChromeStrings,
  zh: zhBundle as ChromeStrings,
}

export function loadI18nBundle(lang: AllowedLanguage): ChromeStrings {
  if (lang === 'en') return BUNDLES.en
  return { ...BUNDLES.en, ...BUNDLES[lang] }
}
```

This makes the function synchronous and bundles all five languages into the worker — ~10–20 KB total uncompressed. Acceptable. Adjust the Server Component call sites to drop the `await`. Choose this path if `node:fs` proves flaky on Workers; otherwise keep the async/`fs` version which lazy-loads.

### Why bundles live at `i18n/` (top-level), not under `app/` or `lib/`

- `app/` is reserved for Next.js routes — putting non-route JSON there is confusing
- `lib/` holds runtime utilities, not data assets
- `i18n/` at the project root is the conventional spot (most i18n tooling expects this); the path is also easy to grep and to manage in CI

### The data-flow asymmetry between cart and order

Cart line items carry `translations` in-memory (Zustand store), populated at "Add to Order" time. The cart can re-render in any of the five languages without touching the DB.

Order line items also carry `translations`, but stored in the `orders.items` jsonb at submit time. The order can be revisited days later (status polling continues for "received"/"preparing"/"ready" states), and the snapshot makes the display deterministic — even if the owner deletes a translation in the meantime, the order page still renders the language the customer saw at submit.

The trade-off is **storage size vs. determinism**. With ≤ 5 languages × 2 fields per line item, the overhead is small enough that determinism wins.

### Variant translation is explicitly out of scope

`VariantGroup.name`, `VariantOption.name`, and the resulting `SelectedVariant.optionName` / `groupName` are NOT translated in 10.2. Reasons:

1. Variants don't have a `translations` column (10.1 added the column on `menu_items`, not on the inline variant JSON shape)
2. Adding variant translations would require either a schema change or a deeply-nested jsonb structure that's painful to edit in the owner UI
3. The customer impact is small — variants are typically single words like "Small / Medium / Large" or numeric price points; menus tend to use universally-recognized terms

If owner feedback after 10.2 ships demands variant translations, a follow-up story (10.3) can extend the model. The variant strings in cart + order will keep showing in the language they were captured in at add-to-cart time.

### Why `pickTranslation` is shared but `loadI18nBundle` is server-only

`pickTranslation` is a pure function over an item shape — it runs in Client Components (where it picks for the active `lang`) and in tests. No I/O.

`loadI18nBundle` does file I/O via `node:fs` — it must run in a Server Component. The `import 'server-only'` guard at the top of `utils/loadI18nBundle.ts` makes accidental client-side imports fail at build time.

### Files this story touches vs. files it must NOT touch

**NEW in 10.2:**
- `i18n/en.json`, `i18n/es.json`, `i18n/fr.json`, `i18n/ja.json`, `i18n/zh.json` — chrome bundles
- `utils/resolveLanguage.ts` — URL/header/default negotiation
- `utils/pickTranslation.ts` — translation picker with fallback
- `utils/loadI18nBundle.ts` — server-only bundle loader
- `utils/formatChrome.ts` — placeholder substitution helper
- `components/customer/LanguageSwitcher.tsx` — globe picker
- `components/customer/HtmlLangPatcher.tsx` — sets `document.documentElement.lang`
- `components/customer/CartPageClient.tsx` — Client island extracted from the existing cart page
- `scripts/check-i18n-coverage.mjs` — CI gate
- `tests/unit/customer/_fixtures/chromeFixture.ts` — test helper
- `tests/unit/utils/resolveLanguage.test.ts`
- `tests/unit/utils/pickTranslation.test.ts`
- `tests/unit/i18n/bundles.test.ts`
- `tests/unit/customer/LanguageSwitcher.test.tsx`

**UPDATE in 10.2:**
- `types/app.ts` — `ChromeStrings` type; `CartItem.translations?`; `OrderItem.translations?`
- `app/[restaurant_slug]/[table_number]/page.tsx` — searchParams, header read, lang resolution, bundle load, new props down
- `app/[restaurant_slug]/[table_number]/cart/page.tsx` — convert from Client Component to Server Component shell + delegate to `CartPageClient`
- `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx` — searchParams, lang resolution, bundle load, new props down
- `components/customer/CustomerMenuClient.tsx` — lang/chrome props, language switcher, `HtmlLangPatcher`
- `components/customer/MenuItemRow.tsx` — pickTranslation, chrome strings
- `components/customer/ItemConfigSheet.tsx` — pickTranslation, chrome strings, snapshot translations into CartItem
- `components/customer/CartBar.tsx` — chrome strings, preserve `?lang=` on nav
- `components/customer/CategoryTabs.tsx` — "Uncategorized" from chrome
- `components/customer/OrderConfirmationScreen.tsx` — chrome strings for status text, pickTranslation for line items, `HtmlLangPatcher`
- `actions/orderActions.ts → submitOrder` — pass-through `translations` into stored `orders.items`
- `package.json` — `check:i18n` + `prebuild` scripts
- Customer test files — new required props, fallback assertions, new chrome fixtures

**MUST NOT touch in 10.2:**
- Owner / admin surfaces (`components/admin/*`, `app/admin/*`) — 10.1's owner-side translations editor is done; 10.2 is read-only on the customer surface
- `restaurants` or `menu_items` schema (`supabase/migrations/*`) — 10.1 made the schema changes; 10.2 only reads
- `menu_items.translations` write paths (`actions/menuActions.ts → updateMenuItemTranslation`) — read-only consumer
- RLS policies — admin client bypasses RLS; no policy changes needed for the customer read path (it already worked pre-10.1)
- Category translations — not modeled in the schema; explicitly out of scope
- Variant translations — same; out of scope (see "Variant translation is explicitly out of scope" above)
- The order confirmation polling logic (the 4-second poll, `orders_customer_status` view) — unchanged; status pill labels come from bundle but the polling/status mechanics are 9.x territory
- KDS / admin order feed — owner-side, English-only, out of scope
- `app/layout.tsx` — do NOT change the root layout's `<html lang>`; the runtime patcher handles per-customer-route lang

### Anti-pattern reminders (specific to 10.2)

| Anti-pattern | Correct pattern |
|---|---|
| Hardcoded English strings in customer JSX (e.g. `"Add to Order"`) | `{chrome['item.addToOrder']}` |
| `item.name` rendered directly on the customer surface | `pickTranslation(item, lang).name` |
| `<Link href={\`?lang=es\`}>` | `router.push(...)` with explicit URLSearchParams handling (preserves other params) |
| Storing `lang` in a Zustand store or React Context | URL `?lang=` + server resolution + props-down |
| Persisting `lang` to `localStorage` | Same — URL is the source of truth |
| Client-side `fetch('/i18n/es.json')` | Server-loaded via `loadI18nBundle`, passed down as `chrome` prop |
| `dangerouslySetInnerHTML` for chrome strings | Plain string render; placeholders use `formatChrome` |
| `Record<OrderStatus, string>` literals in `OrderConfirmationScreen` | `chrome['order.headline.${status}']` lookups |
| Translating variant option/group names | Out of scope — variants stay in default language |
| Translating category names | Out of scope — categories have no `translations` column |
| Setting `<html lang>` from `app/[restaurant_slug]/[table_number]/page.tsx` (it can't — root layout owns it) | `<HtmlLangPatcher lang={lang} />` Client Component |
| Mocking the Supabase admin client by chaining `.from().select().eq().single()` with surprise return shapes | Match the existing menu/order page test patterns (see `app/[restaurant_slug]/[table_number]/page.tsx` integration shape) |

### Lessons carried from Story 10.1's review

- **Distinct `ActionResult.code` per failure mode** (from memory `feedback_action_error_codes.md`): the only Server Action change in 10.2 is the `submitOrder` pass-through. Its existing return shape (`{ success, error }` with no `code`) is untouched — translations on cart items don't introduce new failure modes.
- **Owner-context writes use the cookie client; customer-context reads use the admin client** (from project-context.md, reinforced by 10.1). Story 10.2 is entirely read-only on the customer surface; only the admin client is used.
- **Test fixture sweep is mechanical** (from 10.1 dev notes): `MenuItem` already has `translations: {}` everywhere after 10.1's sweep. The new `lang` and `chrome` props will trigger TS errors in every customer Client Component test render — add them mechanically using the `makeChrome` fixture helper.

### Acceptance gate / Done Gate

This story is read-heavy and UI-heavy. The done gate is:
- All AC tests passing
- All five chrome bundles align with English (CI gate green)
- Manual smoke (Task 9) all checks pass, including the Workers build check
- A real owner-flow walkthrough: enable Spanish on a real test restaurant via the 10.1 owner UI, write a Spanish translation for one item, scan the QR with browser language set to Spanish, complete an order, verify confirmation renders in Spanish

After Task 9 passes, flip the story to `done` in sprint-status.yaml.

### Open questions for future work (not blocking 10.2)

1. **Category translations** — categories have no `translations` column. Future story to add one if owner feedback demands it.
2. **Variant translations** — same; out of scope. Future story would extend the inline variant jsonb shape.
3. **Server-side rendered `<html lang>`** — requires the "multiple root layouts" refactor. Worth it only if SEO of customer pages becomes a goal.
4. **Translation coverage UI for owners** — "Spanish: 5 of 12 items translated" on the owner Settings page. Future story.
5. **Auto-detect language from QR scan domain (e.g. `.es` TLD)** — out of scope; current detection uses Accept-Language only.
6. **Per-user language memory across QR scans** — explicitly avoided (URL-is-source-of-truth). Would re-introduce ambiguity.
7. **RTL languages** — Arabic / Hebrew remain out of scope per 10.1 AC#10.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2: Customer Language Selection & Rendering]
- [Source: _bmad-output/planning-artifacts/prd.md#FR56] — auto-detect from `Accept-Language`
- [Source: _bmad-output/planning-artifacts/prd.md#FR57] — manual language switch persists for session (interpreted here as URL-persisted for the table session)
- [Source: _bmad-output/implementation-artifacts/10-1-translation-data-model-owner-editor.md] — schema, types, `utils/languages.ts`, `MenuItem.translations` shape, anti-patterns
- [Source: app/[restaurant_slug]/[table_number]/page.tsx] — existing SSR shape using admin client; pattern to extend
- [Source: app/[restaurant_slug]/[table_number]/cart/page.tsx] — current Client Component; convert to Server Component shell
- [Source: app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx] — existing SSR with admin client; pattern to extend
- [Source: components/customer/CustomerMenuClient.tsx] — header where switcher lands
- [Source: components/customer/OrderConfirmationScreen.tsx] — module-scope status-string literals that move into the chrome bundle
- [Source: actions/orderActions.ts → submitOrder] — accumulator + insert; gains `translations` pass-through
- [Source: utils/languages.ts] — `ALLOWED_LANGUAGES`, `AllowedLanguage`, `LANGUAGE_LABEL`, `isAllowedLanguage`
- [Source: _bmad-output/project-context.md] — admin client for customer SSR, no Node-native APIs on edge, no `.select()` on customer INSERTs
- [Memory: project_supabase_anon_role.md] — sessionless customer flow uses admin client; no `auth.users` row created. 10.2 is read-only and inherits this.
- [Memory: project_postgres_42501_returning.md] — admin client bypasses the 42501 RETURNING trap; the existing `submitOrder` `.select('id').single()` after insert is safe and unchanged.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context)

### Debug Log References

- **Edge-runtime decision for `loadI18nBundle`:** project-context.md explicitly bans Node `fs` on Cloudflare Workers. Switched from the async `node:fs` primary path to the static-import fallback the story flagged as the alternative. The loader is now synchronous; the Server Component shells call it without `await`. Bundles import as `Record<string, string>` via `resolveJsonModule: true` in `tsconfig.json`.
- **Added chrome key `cart.placingOrderAriaLabel`:** the existing cart page had a distinct visual label ("Placing order…") and aria-label ("Placing order, please wait"). The story's seed key list collapsed those into one key; splitting them keeps the aria-label translatable separately. Added to all 5 bundles and the chrome fixture.
- **CartPage test retargeted at `CartPageClient`:** the old `tests/unit/customer/CartPage.test.tsx` rendered the Server Component shell `CartPage` directly. After conversion to async Server Component, that's impossible in jsdom. The test now renders the Client island `CartPageClient` directly and supplies the lang/chrome/defaultLanguage props that the shell would pass.
- **CI gate verification:** ran a destructive simulation (deleted `cart.total` from `es.json`, added `extra.key`) → `npm run check:i18n` exited 1 with both gaps listed. Restored bundle, re-ran → exited 0.
- Pre-existing lint/tsc errors (~83k lint, 9 tsc in `tests/rls`, `tests/unit/tables/*`, `tests/unit/menu/CategoryManager.test.tsx`) are unrelated to 10.2 and were not touched.

### Completion Notes List

- Tasks 1–8 and 10 complete; Task 9 (manual smoke) deferred to user.
- Pragmatic `<html lang>` choice landed exactly as scoped: `HtmlLangPatcher` Client Component sets `document.documentElement.lang` post-hydration. The initial SSR paint still has `lang="en"` from the root layout — documented caveat preserved.
- Translation snapshot data flow validated end-to-end through tests: ItemConfigSheet captures `item.translations` into the cart item → `submitOrder` writes the snapshot into `orders.items` jsonb → OrderConfirmationScreen reads it back and falls back to stored `name` for pre-10.2 orders.
- Switcher hides itself when `supported_languages.length <= 1` so restaurants with only English enabled see no visual change.
- `?lang=` URL convention: omitted when resolved == default_language; explicitly carried by CartBar (menu → cart), CartPageClient empty-cart redirect, and the post-submit replace into the order tracking route.
- Bundle key coverage: 32 keys × 5 bundles, all aligned (verified by `npm run check:i18n` AND `tests/unit/i18n/bundles.test.ts`).
- Test suite: **640 tests pass (was 575 pre-10.2)** — added 65 new tests across utilities, switcher, bundles, and translation/chrome assertions on existing components.

### File List

**NEW:**
- `utils/resolveLanguage.ts` — URL > default > 'en' resolution. (Accept-Language step removed per 2026-05-22 Change Log; the helper used to also export `negotiateLanguage` — now removed.)
- `utils/pickTranslation.ts` — translation picker with default-column fallback
- `utils/loadI18nBundle.ts` — synchronous, server-only bundle loader using static JSON imports (Workers-compatible)
- `utils/formatChrome.ts` — `{placeholder}` substitution helper
- `i18n/en.json`, `i18n/es.json`, `i18n/fr.json`, `i18n/ja.json`, `i18n/zh.json` — 32-key chrome bundles
- `components/customer/LanguageSwitcher.tsx` — globe/check menu with keyboard nav
- `components/customer/HtmlLangPatcher.tsx` — sets `document.documentElement.lang` on mount
- `components/customer/CartPageClient.tsx` — Client island extracted from the cart page; receives lang/chrome from the shell
- `scripts/check-i18n-coverage.mjs` — CI gate; wired into `prebuild`
- `tests/unit/utils/resolveLanguage.test.ts` — 18 tests (URL/header/default chain, BCP-47 fallback, malformed input)
- `tests/unit/utils/pickTranslation.test.ts` — 7 tests (translation present/absent, empty-string trim, null description)
- `tests/unit/utils/formatChrome.test.ts` — 5 tests (substitution, missing placeholders left intact, number coercion)
- `tests/unit/i18n/bundles.test.ts` — sibling of CI gate; asserts every bundle equals en.json key set
- `tests/unit/customer/LanguageSwitcher.test.tsx` — 9 tests (single-lang hide, current-mark, ?lang= toggling, Escape/outside-click)
- `tests/unit/customer/_fixtures/chromeFixture.ts` — `makeChrome(overrides)` helper used across customer tests

**UPDATED:**
- `types/app.ts` — added `ChromeStrings`; `CartItem.translations?`; `OrderItem.translations?`
- `app/[restaurant_slug]/[table_number]/page.tsx` — searchParams + Accept-Language read, lang resolution, bundle load, language props down to client
- `app/[restaurant_slug]/[table_number]/cart/page.tsx` — converted from Client Component to Server Component shell; delegates to CartPageClient
- `app/[restaurant_slug]/[table_number]/order/[order_id]/page.tsx` — same resolution + bundle load; passes translations field through to OrderConfirmationScreen
- `components/customer/CustomerMenuClient.tsx` — new required props; renders HtmlLangPatcher + LanguageSwitcher in header; threads lang+chrome to children
- `components/customer/MenuItemRow.tsx` — required `lang` + `chrome`; pickTranslation; chrome label for "Not available right now"
- `components/customer/ItemConfigSheet.tsx` — required `lang` + `chrome`; pickTranslation; chrome label for Add-to-Order; captures `item.translations` into cart item on add
- `components/customer/CartBar.tsx` — required `lang`, `chrome`, `defaultLanguage`; chrome strings; appends `?lang=` to cart URL when non-default
- `components/customer/CategoryTabs.tsx` — required `chrome`; "Uncategorized" from bundle
- `components/customer/OrderConfirmationScreen.tsx` — required `lang` + `chrome`; chrome lookups keyed by status; pickTranslation on items; HtmlLangPatcher; table caption via formatChrome
- `actions/orderActions.ts → submitOrder` — pass-through of `cartItem.translations` into the accumulated `orders.items` row
- `package.json` — added `check:i18n` and `prebuild` scripts
- `tests/unit/customer/MenuItemRow.test.tsx` — migrated to new props via renderRow helper; +3 tests (translated name, fallback, chrome label)
- `tests/unit/customer/ItemConfigSheet.test.tsx` — migrated via renderSheet helper; +3 tests (translation rendering, fallback, add-to-cart translations passthrough)
- `tests/unit/customer/CartBar.test.tsx` — migrated to new props; +1 test (preserves `?lang=` on non-default)
- `tests/unit/customer/CartPage.test.tsx` — retargeted at CartPageClient; +3 tests (translated names, fallback, ?lang= on submit redirect)
- `tests/unit/customer/OrderConfirmationScreen.test.tsx` — added `lang` + `chrome` to defaultProps; +4 tests (translated item name, fallback for pre-10.2 orders, chrome bundle lookups, table caption interpolation)
- `tests/unit/actions/orderActions.test.ts` — +2 tests (translations snapshot persisted into orders.items; absent when cart item has no translations)

### Change Log

- 2026-05-22: Story 10.2 implementation — customer-side language resolution, chrome bundles, switcher, translated rendering across menu/cart/order, CI coverage gate. 640 tests pass (+65 new); all 11 ACs satisfied except AC#11 manual smoke (deferred to user).
- 2026-05-22: Mid-review design fix — dropped `Accept-Language` from the resolver. New chain is `?lang=` → `default_language` → `'en'`. Owner reported that English-default restaurants on Japanese-locale browsers were rendering in Japanese due to Accept-Language detection; that contradicted the owner's mental model of "default language". Diverges from AC#1 priority 2 and PRD FR56 — both updated to reflect. `resolveLanguage` simplified (no `acceptLanguageHeader` arg, no `negotiateLanguage` helper). Server Components no longer call `headers()`. Tests rewritten (now 631 passing; 9 Accept-Language tests removed).
