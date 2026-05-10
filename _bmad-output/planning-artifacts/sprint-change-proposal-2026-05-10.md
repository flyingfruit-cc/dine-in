# Sprint Change Proposal — 2026-05-10

## 1. Issue Summary

**Problem:** Story 1.3's signup flow assumes Supabase email confirmation is disabled (autoconfirm ON). When email confirmation is enabled, `supabase.auth.signUp()` returns `{ data: { user, session: null }, error: null }` — no error, but also no active session. The form silently advances to Step 2 (restaurant setup), which then fails with "Not authenticated" when calling the `createRestaurant()` Server Action.

**When discovered:** During manual testing of Story 1.3 post-implementation. User signed up, was advanced to the restaurant setup form, submitted it, and received "Not authenticated". Only after checking email and clicking the Supabase confirmation link did the account become active.

**UX consequence:** Users land on the restaurant setup form believing signup is complete, submit it, get an error, and are confused about what went wrong. The email confirmation requirement is invisible.

**Evidence:**
- `signUp()` returns `session: null` + `error: null` when confirmation is required
- `createRestaurant()` Server Action calls `supabase.auth.getUser()` → null → `{ success: false, error: 'Not authenticated' }`
- The `/auth/confirm` route and `/auth/onboarding` page already exist and are the correct post-confirmation infrastructure

---

## 2. Impact Analysis

**Epic Impact:** Epic 1 only — no other epics affected.

**Story Impact:**
- Story 1.3 (done): Bug fix required in `components/sign-up-form.tsx`
- Story 1.4 (backlog): No changes — login/logout/password reset flow unaffected

**Artifact Conflicts:**
- PRD: No change — email confirmation is an auth infrastructure detail, not a product requirement
- Epics: No change — the AC for Story 1.3 is still satisfied once the flow handles both confirmation modes
- Architecture: No change — `emailRedirectTo` + `/auth/confirm?next=` pattern is already the established auth pattern in the project
- UX Design: No change — "Check your email" state is a standard onboarding UI pattern implicit in any email-confirmation auth flow

**Technical Impact:**
- `components/sign-up-form.tsx` — add step 3 (email confirmation pending) state, check `data.session` after signUp, add `emailRedirectTo`
- No DB changes, no migration, no new routes (all infrastructure already exists)

---

## 3. Recommended Approach: Direct Adjustment (Minor)

**Path:** Bug fix within Story 1.3 — modify the signup form to handle both email confirmation states.

**Implementation:**
1. After `signUp()`, check `data.session`:
   - `session !== null` (autoconfirm ON) → advance to Step 2 (restaurant setup inline, existing behavior)
   - `session === null` (confirmation required) → advance to Step 3 ("Check your email" state)
2. Add `emailRedirectTo: ${origin}/auth/confirm?next=/auth/onboarding` to `signUp()` options — after confirmation, user lands on `/auth/onboarding` to complete restaurant setup
3. Step 3 UI: show email address, "We've sent a confirmation link — click it to activate your account and finish setup"

**Why this is correct:**
- Works in both confirmation modes — no Supabase configuration dependency
- Uses existing `/auth/confirm` route (already handles `?next=` redirect)
- Uses existing `/auth/onboarding` page (already handles restaurant setup with active session)
- No new routes, no new dependencies

**Effort:** ~30 min (single component edit)
**Risk:** Low — purely additive UI state, existing success path unchanged
**Timeline impact:** None — Story 1.3 status stays `done` after fix

---

## 4. Detailed Change Proposals

### Change 1: `components/sign-up-form.tsx`

**Section:** Step 1 submit handler + step state machine + new Step 3 UI

**OLD (step state):**
```typescript
const [step, setStep] = useState<1 | 2>(1)
```

**NEW:**
```typescript
const [step, setStep] = useState<1 | 2 | 3>(1)
```

**OLD (signUp call):**
```typescript
const { error } = await supabase.auth.signUp({ email, password })
setIsLoading(false)
if (error) { setFormError(error.message); return }
setStep(2)
```

**NEW:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/onboarding`,
  },
})
setIsLoading(false)
if (error) { setFormError(error.message); return }
if (!data.session) {
  setStep(3)  // Email confirmation required — show "check your email" state
  return
}
setStep(2)  // Autoconfirm ON — proceed directly to restaurant setup
```

**NEW Step 3 UI (email confirmation pending):**
- Heading: "Check your email"
- Body: "We've sent a confirmation link to `{email}`. Click it to activate your account, then you'll be taken to complete your restaurant setup."
- No form fields — user just needs to check their email
- Optional: "Didn't receive it?" link/button to resend

**Rationale:** Makes the flow correct regardless of Supabase confirmation setting. The `/auth/onboarding` page handles restaurant setup post-confirmation.

---

## 5. Implementation Handoff

**Scope Classification:** Minor — direct implementation by Developer agent

**Handoff:** Developer implements Change 1 directly

**Success Criteria:**
- With email confirmation ON: signup → "Check your email" UI visible with correct email address → confirm email → land on `/auth/onboarding` → enter restaurant details → redirect to `/admin`
- With email confirmation OFF (autoconfirm): signup → Step 2 restaurant setup inline → submit → redirect to `/admin` (existing behavior unchanged)
- No regression on slug validation, error routing, or admin layout guard
