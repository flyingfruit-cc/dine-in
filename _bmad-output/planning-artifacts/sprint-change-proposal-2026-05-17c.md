# Sprint Change Proposal — Persistent Menu Preview Access
**Date:** 2026-05-17
**Scope:** Minor — direct implementation by Developer agent

---

## Section 1: Issue Summary

**Problem statement:**
After a restaurant owner visits the menu preview for the first time, the `recordMenuPreview()` action sets `has_previewed_menu = true`. The OnboardingChecklist marks the "Preview menu" step complete and removes its CTA link (`{!step.complete && <Link ...>}`). There is no other UI entry point to `/admin/menu/preview`. The owner effectively cannot re-preview after making menu changes without manually typing the URL.

**When discovered:**
Identified during walkthrough of the post-publish onboarding flow. After completing the preview step, returning to the menu to make edits (add items, adjust prices) leaves the owner with no way to check their changes.

**Evidence:**
- `app/admin/menu/page.tsx` — no preview link exists on the menu builder page
- `components/admin/OnboardingChecklist.tsx:95` — CTA is conditionally rendered only when `!step.complete`
- Story 2.6 ACs — specify the preview content and read-only state, but never require a persistent navigation path from the menu builder
- The preview page itself is fully functional on re-visit; `recordMenuPreview()` is idempotent — the bug is purely navigational

---

## Section 2: Impact Analysis

**Epic impact:**
- Epic 2 (Menu Building & Publishing) — Story 2.6 has a missing AC; the story is otherwise done

**Story impact:**
- Story 2.6 (done) — missing AC for persistent preview access from the menu builder
- Story 2.7 (done) — the publish flow naturally prompts re-inspection of the menu after edits; this gap compounds the publish story's UX

**Artifact conflicts:**
- Epics — Story 2.6 needs one additional AC
- PRD — FR13 says "preview the menu exactly as customers will see it before publishing"; the word "before" implies repeated use, not a one-time event. No FR text change needed but the implementation was too narrow.
- UX spec — states "Preview mode mirrors the customer flow exactly — what Marco sees is what Aisha sees" in the menu builder context, implying preview is a persistent companion to the builder, not a one-time onboarding gate

**Technical impact:**
- `app/admin/menu/page.tsx` — add a "Preview menu" secondary link/button
- No new actions, no DB changes, no schema changes
- `recordMenuPreview()` is already idempotent — re-visits are safe

---

## Section 3: Recommended Approach

**Direct Adjustment — add a persistent preview link to the menu page.**

The right placement is in the menu page header, alongside the `<h1>Menu</h1>`, as a secondary text-link action. This mirrors the UX spec's "Secondary action" pattern (transparent, border, text) and gives owners a clear, consistent path to preview at any point.

**What changes:**
- `app/admin/menu/page.tsx` — add "Preview menu →" link next to the heading
- `_bmad-output/planning-artifacts/epics.md` — add AC to Story 2.6

**What stays the same:**
- `OnboardingChecklist` — no change; the "Preview →" CTA correctly disappears once the onboarding step is done (that's its purpose). The fix is adding a permanent home for preview on the menu page.
- `recordMenuPreview()` — idempotent, no change needed
- `app/admin/menu/preview/page.tsx` — no change

**Effort estimate:** 30 minutes
**Risk:** None — additive change, single file touch
**Timeline impact:** None

---

## Section 4: Detailed Change Proposals

### Change 1 — `app/admin/menu/page.tsx`

**OLD:**
```tsx
<h1 className="mb-6 text-2xl font-semibold text-text-primary">Menu</h1>
<section className="mb-10">
  <MenuPublishToggle isPublished={restaurant?.is_published ?? false} />
</section>
```

**NEW:**
```tsx
<div className="mb-6 flex items-center justify-between">
  <h1 className="text-2xl font-semibold text-text-primary">Menu</h1>
  <Link href="/admin/menu/preview" className="text-sm text-accent hover:underline">
    Preview menu →
  </Link>
</div>
<section className="mb-10">
  <MenuPublishToggle isPublished={restaurant?.is_published ?? false} />
</section>
```

Add `import Link from 'next/link'` at the top.

**Rationale:** Persistent secondary action in the page header — accessible at any time, regardless of onboarding progress. Follows the UX spec's text-link pattern for low-emphasis navigation.

---

### Change 2 — Story 2.6 in epics.md

**ADD** after the existing last AC ("no Admin UI controls are visible"):

```markdown
**Given** an owner is on the menu builder page (`/admin/menu`)
**When** the page renders
**Then** a "Preview menu →" link is visible in the page header at all times
**And** clicking it navigates to `/admin/menu/preview`
```

**Rationale:** Preview is a companion to the menu builder, not a one-time onboarding gate. Owners need to re-preview after every round of edits.

---

## Section 5: Implementation Handoff

**Change scope: Minor** — direct implementation by Developer agent.

**Files to modify:**
| File | Action |
|------|--------|
| `app/admin/menu/page.tsx` | Add `Link` import + "Preview menu →" in page header |
| `_bmad-output/planning-artifacts/epics.md` | Add AC to Story 2.6 |

**Success criteria:**
- [ ] "Preview menu →" link is visible on `/admin/menu` at all times
- [ ] Link navigates to `/admin/menu/preview`
- [ ] Preview page still calls `recordMenuPreview()` (idempotent — no functional change)
- [ ] OnboardingChecklist behaviour unchanged
- [ ] All 168 unit tests pass
