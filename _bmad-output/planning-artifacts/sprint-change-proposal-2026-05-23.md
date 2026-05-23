# Sprint Change Proposal — 2026-05-23

## Issue Summary

`/admin` (the post-login landing route) renders only an `<h1>Dashboard</h1>` header once an owner finishes onboarding. The page's sole content is `OnboardingChecklist`, which by design returns `null` when all five setup steps are complete (`components/admin/OnboardingChecklist.tsx:62`). Result: every onboarded owner sees a true blank page on every sign-in.

Discovered via manual usage (dogfooding). No story triggered it — the gap was that Story 2.7 specified the checklist's auto-hide behavior but never specified what should fill the surface after it hides. Violates two UX spec rules:
- §UX Consistency Patterns line 686: "Every empty state has a contextual prompt"
- §Empty States line 868: "Always tells the user what to do next"

## Impact Analysis

**Epic Impact**
- No in-flight epic — all 10 epics are `done` in `sprint-status.yaml`. Cleanest possible state for additive work.
- Epic 2 Story 2.7 is the source of the auto-hide behavior but is itself correct; no rework needed there.

**Story Impact**
- New: Epic 11, Story 11.1 (Dashboard Landing Snapshot) added as `backlog`.
- No existing stories modified.

**Artifact Conflicts**
| Artifact | Action |
|---|---|
| `_bmad-output/planning-artifacts/prd.md` | Add FR4a under "Restaurant Onboarding & Account Management" defining dashboard landing content |
| `_bmad-output/planning-artifacts/epics.md` | Add Epic 11 line to Epic List; add UX-DR9 to UX Design Requirements; append full Epic 11 + Story 11.1 block |
| `_bmad-output/planning-artifacts/ux-design-specification.md` | Amend Component #6 (OnboardingChecklist) "All complete" state; add Component #7 (DashboardLandingSnapshot); add P1 row to Component Implementation Strategy |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Update `last_updated` + `last_event`; append `epic-11` block |

**Technical Impact**
- No schema changes. No new RLS policies. No new migrations.
- Reuses existing `orders` table, existing `lib/supabase/server.ts` cookie client, existing utilities (`formatPrice.ts`, `formatTime.ts`).
- Net-new code: one Server Component (`components/admin/DashboardLandingSnapshot.tsx`) + Vitest unit tests. Modify `app/admin/page.tsx` to render either `OnboardingChecklist` OR `DashboardLandingSnapshot` based on onboarding completion (moves rendering decision up from the checklist component).

**Architecture Impact**
- None. Patterns match existing Server Component / parallel `Promise.all` / cookie-client / RLS conventions documented in `_bmad-output/project-context.md`.

## Recommended Approach

**Option 3 — New Epic 11 "Admin Dashboard Landing", single story.**

Considered alternatives:
- **Option 1: Direct Adjustment** (retrofit into Story 2.7). Rejected — muddies a `done` story's history for a genuinely net-new surface.
- **Option 2: Rollback**. Not applicable — nothing to roll back; checklist behavior is correct.
- **Option 3: New Epic 11**. Selected — follows the established pattern of Epics 7–10 (post-MVP Phase 2 additions), keeps story lineage clean, and the work is additive (new FR, new UX component, new code) rather than a fix.

Effort: Low–Medium. Risk: Low.

## Detailed Change Proposals

### Change 1 — PRD addition (FR4a)

File: `_bmad-output/planning-artifacts/prd.md` — insert under "Restaurant Onboarding & Account Management" after FR4 (line 274):

```
- **FR4a:** When a restaurant owner signs in to the Admin UI and lands on `/admin`,
  the Dashboard surface presents a live service snapshot — today's active-order count,
  today's completed-order count, today's revenue total, the 3–5 most recent orders,
  and quick-action links to Orders, KDS, Menu, and Settings. While onboarding is
  incomplete, the `OnboardingChecklist` takes precedence and replaces the snapshot.
```

### Change 2 — Epics file (three edits)

File: `_bmad-output/planning-artifacts/epics.md`

**2A.** Append to Epic List section (after Epic 10 line ~247):
```
### Epic 11: Admin Dashboard Landing *(Post-MVP — Phase 2)*
Replace the post-onboarding blank `/admin` page with a live service snapshot —
today's order counts, today's revenue, recent orders preview, and quick actions.
Resolves the dead-end empty state when `OnboardingChecklist` auto-hides.
```

**2B.** Add to UX Design Requirements (appended after UX-DR16; UX-DR9 was already taken by the customer-menu D1 direction, so the new requirement is **UX-DR17**):
```
UX-DR17: Build **DashboardLandingSnapshot** custom component — replaces
  OnboardingChecklist on `/admin` once all onboarding steps are complete.
  Anatomy: today-stats card (active orders · today's orders · today's revenue) +
  recent-orders list (top 5, table + items + relative time + handled state) +
  quick-actions row (Orders · KDS · Menu · Settings). State: live (Server
  Component on each navigation; no client-side polling).
```

**2C.** Append full Epic 11 block at end of file:
```
---

## Epic 11: Admin Dashboard Landing *(Post-MVP — Phase 2)*

Once an owner completes onboarding, `/admin` must continue to be a useful landing
surface — not an empty page. This epic replaces the auto-hidden OnboardingChecklist
with a live service snapshot that gives owners an at-a-glance read of today's
activity and one-tap routes to the surfaces they use most.

### Story 11.1: Dashboard Landing Snapshot

As a restaurant owner,
I want the Admin Dashboard to show today's order activity and quick links the moment I land on it,
So that signing in feels purposeful instead of dropping me on an empty page.

**Acceptance Criteria:**

**Given** an owner has completed all onboarding steps (`is_published = true`, has menu items, has previewed menu, has tables, has printed QR)
**When** the owner navigates to `/admin`
**Then** the page renders a `DashboardLandingSnapshot` with three sections — Today, Recent Orders, Quick Actions — and does NOT render the OnboardingChecklist

**Given** an owner has NOT completed all onboarding steps
**When** the owner navigates to `/admin`
**Then** the OnboardingChecklist is rendered as today
**And** the DashboardLandingSnapshot is NOT rendered

**Given** the snapshot renders the Today section
**When** the page loads
**Then** it shows: count of orders with `handled_at IS NULL` for today (active), count of orders submitted today (total), and sum of `total_cents` for orders submitted today (revenue, formatted via `utils/formatPrice.ts`)

**Given** the snapshot renders the Recent Orders section
**When** the page loads
**Then** the most recent 5 orders for the restaurant are listed, each showing table number, item-summary (first 2 items + "+N more"), relative time, and handled state
**And** a "Go to Orders →" link routes to `/admin/orders`

**Given** the snapshot renders the Quick Actions section
**When** the page loads
**Then** it shows tappable links to `/admin/orders`, `/admin/kds`, `/admin/menu`, `/admin/settings`
**And** on mobile (sm only) the KDS link is hidden (KDS is desktop-only per `AdminNav.tsx`)

**Given** the restaurant has zero orders today
**When** the snapshot renders
**Then** Today section shows "0 active · 0 today · $0.00"
**And** Recent Orders section shows "No orders yet — orders will appear here automatically" (matching empty-state copy convention in UX spec §Empty States line 821)

**Given** the page is a Server Component
**When** data is fetched
**Then** the cookie-bound server client (`lib/supabase/server.ts`) is used (owner JWT → RLS enforces tenant isolation)
**And** all three queries run in parallel via `Promise.all`
```

### Change 3 — UX Spec amendments (three edits)

File: `_bmad-output/planning-artifacts/ux-design-specification.md`

**3A.** Amend Component #6 (OnboardingChecklist) States row (line 760):
```
| **States** | Incomplete · Complete (checkmark, muted) · All complete (component is no longer rendered by `/admin`; replaced by **DashboardLandingSnapshot** — see #7) |
```

**3B.** Insert Component #7 immediately after Component #6 (before line 764):
```
**7. DashboardLandingSnapshot**

| Attribute | Specification |
|---|---|
| **Purpose** | Live service snapshot on `/admin` once onboarding is complete — replaces OnboardingChecklist as the dashboard landing surface |
| **Anatomy** | Today card (3 stats: active orders · today's orders · today's revenue) · Recent Orders list (top 5 rows + "Go to Orders →") · Quick Actions row (Orders · KDS · Menu · Settings) |
| **States** | Default (≥1 order today) · Empty-today (Today card shows zeros, Recent Orders shows empty-state copy from §Empty States) |
| **Variants** | Mobile (Quick Actions hides KDS — desktop-only) · Desktop (all 4 quick actions) |
| **Interaction** | Server Component — refreshed on navigation to `/admin`. No client-side polling. Each Recent Order row reuses tap behavior of `OrderCard` (row expands to full item list). Quick Action links route via Next `<Link>` |
| **Accessibility** | Today card: `role="region"`, `aria-label="Today's activity"`. Stats announced as "{n} active orders, {n} today, {revenue} revenue". Recent Orders list: `role="list"` with each row as `role="listitem"`. Quick Actions: `role="navigation"`, `aria-label="Quick actions"` |
| **Content rules** | Empty-today copy: "No orders yet — orders will appear here automatically" (matches §Empty States line 821). Revenue: always via `utils/formatPrice.ts`. Relative time: always via `utils/formatTime.ts`. No toast on data load — calm by design (§Real-time updates line 824) |
```

**3C.** Add to Component Implementation Strategy table (after the OnboardingChecklist row, line 773):
```
| P1 | DashboardLandingSnapshot | Post-onboarding dashboard is a dead-end empty page |
```

### Change 4 — sprint-status.yaml updates

File: `_bmad-output/implementation-artifacts/sprint-status.yaml`

**4A.** Update header lines (lines 39–40):
```
last_updated: 2026-05-23
last_event: Sprint Change Proposal 2026-05-23 approved — Epic 11 (Admin Dashboard Landing) added, Story 11.1 backlog
```

**4B.** Append at end of `development_status:` (after line 119):
```
  # Epic 11: Admin Dashboard Landing (Post-MVP — Phase 2)
  epic-11: backlog
  11-1-dashboard-landing-snapshot: backlog
  epic-11-retrospective: optional
```

## MVP Impact

None. MVP is already done (Epics 1–6). This is a Phase 2 post-MVP addition consistent with Epics 7–10.

## Implementation Handoff Plan

**Scope classification: Moderate** — multi-artifact spec updates plus net-new code.

**Step 1 (PO/spec updates — apply on approval of this proposal):**
- Apply Changes 1, 2, 3, 4 to the planning + implementation artifact files
- Owner: Developer agent acting in PO capacity (Nic)

**Step 2 (Dev implementation):**
- Hand Story 11.1 to `bmad-create-story` to produce a context-filled story file under `_bmad-output/implementation-artifacts/`
- Then `bmad-dev-story` for implementation
- Owner: Developer agent (Nic / Amelia)
- Deliverables:
  - `components/admin/DashboardLandingSnapshot.tsx` (Server Component)
  - `components/admin/DashboardLandingSnapshot.test.tsx` (Vitest)
  - Updated `app/admin/page.tsx` (route between checklist vs. snapshot based on onboarding completion)
  - No changes to `OnboardingChecklist.tsx` required — its existing auto-hide behavior continues to work; the parent simply chooses which component to render
- Update `sprint-status.yaml` story status as it progresses (`backlog` → `ready-for-dev` → `in-progress` → `review` → `done`)

**Success criteria:**
- Post-onboarding sign-in lands on a populated `/admin` with three sections (Today, Recent Orders, Quick Actions)
- Empty-today state shows the contextual copy specified in AC, not a blank panel
- Onboarding-incomplete users still see the OnboardingChecklist as today
- Unit tests cover: onboarding-complete vs incomplete branching, empty-today copy, revenue formatting, quick-action route correctness
- No regressions in existing `/admin` redirect behavior (`layout.tsx:21` `restaurant_id` check)
