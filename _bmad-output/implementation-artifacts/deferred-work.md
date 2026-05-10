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
