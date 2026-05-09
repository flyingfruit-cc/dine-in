# Deferred Work

## Deferred from: code review of 1-1-project-initialization-infrastructure-setup (2026-05-09)

- `global_fetch_strictly_public` flag in `wrangler.toml` blocks private/loopback IPs — only relevant when using `wrangler dev` against local Supabase; not blocking for CF production. Revisit when local wrangler dev workflow is tested.
- `CLOUDFLARE_ACCOUNT_ID` not injected in CI deploy job — wrangler may auto-detect from API token; verify during first actual deploy and add explicit secret if multi-account token is used.
- `instrumentation.ts` Sentry init may not fire on Cloudflare Workers runtime — `NEXT_RUNTIME` checks cover `nodejs` and `edge` but CF Workers via OpenNext may use a different label; needs testing post-first-deploy.
- `next`, `@supabase/ssr`, `@supabase/supabase-js` pinned to `"latest"` in `package.json` — any `npm install` will silently bump these; only `package-lock.json` guards stability. Consider pinning to exact versions in a future hardening pass.

## Deferred from: code review of 1-2-database-schema-rls-policies-security-foundation (2026-05-09)

- `custom_access_token_hook` registration cannot be automated via SQL or MCP — must be done manually in Supabase Dashboard → Authentication → Hooks. No pre-flight check enforces this before the test suite runs. Consider adding a smoke test in `beforeAll` that verifies `auth.jwt() -> 'app_metadata'` returns the expected shape.
- `Date.now()` suffix in test describe blocks theoretically collides if parallel Playwright workers start within the same millisecond — in practice highly unlikely, but a `crypto.randomUUID()` slice would be more robust.
