# Sprint Change Proposal — 2026-05-10 (b)

## 1. Issue Summary

**Problem:** After clicking the email confirmation link, user is redirected to `/auth/error?error=No token hash or type`.

**Root cause:** `app/auth/confirm/route.ts` only handles the `token_hash` + `type` OTP flow. With `@supabase/ssr` v0.10.3 and PKCE enabled (default), Supabase sends a `code` parameter in the confirmation redirect, not `token_hash`. The route finds no `token_hash`, falls through, and redirects to the error page.

**Supabase redirect formats:**
- Old / non-PKCE: `/auth/confirm?token_hash=xxx&type=signup&next=...`
- PKCE (current default): `/auth/confirm?code=xxx&next=...`

The route only handles the first format.

---

## 2. Impact Analysis

- **Epic 1 / Story 1.3 (done):** Bug in `app/auth/confirm/route.ts` — fix needed
- No other epics, no DB changes, no migrations

---

## 3. Recommended Approach: Direct Adjustment (Minor)

Handle both `code` (PKCE exchange) and `token_hash` (OTP verify) in the confirm route — this is what the official Supabase Next.js template does. The `code` branch takes priority since it is now the default.

---

## 4. Change Proposal

**File:** `app/auth/confirm/route.ts`

Add `code` handling before the existing `token_hash` branch:

```typescript
const code = searchParams.get("code")
if (code) {
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) redirect(next)
  redirect(`/auth/error?error=${encodeURIComponent(error.message)}`)
}
```

Also encode the error message in the existing `token_hash` error redirect to avoid URL issues with special characters.

---

## 5. Implementation Handoff

**Scope:** Minor — Developer direct implementation
**Success criteria:** After clicking email confirmation link → session established → redirected to `/auth/onboarding` → restaurant setup form visible
