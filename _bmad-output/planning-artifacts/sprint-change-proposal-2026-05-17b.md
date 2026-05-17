# Sprint Change Proposal — Restaurant Settings Page
**Date:** 2026-05-17
**Scope:** Minor — direct implementation by Developer agent

---

## Section 1: Issue Summary

**Problem statement:**
Restaurant owners set up their restaurant name and URL slug during onboarding (`/auth/onboarding`) but have no way to find, view, or edit this information once they're in the Admin UI. There is no settings page and no reference to these values anywhere in the admin surface.

**When discovered:**
Identified during walkthrough of the admin UI post-onboarding. The onboarding form clearly shows "dine-in/{slug}" as the customer URL, but that value is invisible after the user lands on `/admin`.

**Why this matters:**
- Owners need to know their slug to explain the QR URL to staff ("tell customers to scan the code at dine-in/blue-plate")
- A typo in the restaurant name during onboarding has no recovery path
- The "Settings" tab was planned in the UX spec (UX-DR11, UX-DR15) but never built

---

## Section 2: Impact Analysis

**Epic impact:**
- Epic 1 (Auth & Foundation) — the settings story belongs here as a late addition; it's logically a continuation of Story 1.3 (restaurant profile creation)

**Story impact:**
- Story 1.3 (done) — created the restaurant profile; settings is its read/edit counterpart
- No future stories are blocked, but the Tables story (3.1) assumes owners know their slug for QR URL validation

**Artifact conflicts:**
- PRD — FR2 only covers CREATE. Needs a new FR for VIEW and EDIT name
- Epics — Needs Story 1.5 inserted after Story 1.4
- UX spec — "Settings" tab exists in the nav spec but page content was never designed (gap)
- AdminNav — currently has Dashboard · Menu · Tables (3 tabs); needs Settings as a 4th tab

**Slug editability decision:**
The slug **cannot be changed** safely — QR code URLs are `/{slug}/{table_number}`. Changing the slug would invalidate all printed QR codes. Settings will show the slug as read-only with a brief explanation.

**Technical impact:**
- New page: `app/admin/settings/page.tsx` (server component — reads restaurant data)
- New server action: `updateRestaurantName()` in `actions/restaurantActions.ts`
- New component: `components/admin/RestaurantSettings.tsx` (client component for inline save)
- `AdminNav` update: add Settings tab (4th tab on mobile, 4th item on desktop sidebar)
- RLS: owner can already UPDATE their own `restaurants` row — no policy changes

---

## Section 3: Recommended Approach

**Direct Adjustment — add Story 1.5 and implement the Settings page.**

Rationale:
- The nav tab was already specced; the page content is simple (2 fields, 1 action)
- No schema changes needed — `restaurants.name` is already writable
- Slug read-only is the safe call — no risk of invalidating QR codes
- Effort is small enough to do within the current sprint without disrupting Epic 3 start

**Settings page content (MVP):**
1. **Restaurant name** — editable inline, saved with a "Save" button, success/error feedback inline
2. **URL slug** — read-only display, prefixed with `dine-in/`, tooltip or note: "Your slug is fixed — changing it would break existing QR codes"
3. **Password** — text link to `/auth/update-password`

**Effort estimate:** 2–3 hours
**Risk:** Low — read/update of owner's own restaurant row, already covered by RLS
**Timeline impact:** None — completes a gap before Epic 3 starts

---

## Section 4: Detailed Change Proposals

### Change 1 — PRD: New functional requirement

**Section:** Functional Requirements — Restaurant Owner

**ADD** after FR2:
```
- **FR43:** Restaurant owner can view their restaurant name and URL slug from the Admin Settings page
- **FR44:** Restaurant owner can update their restaurant name from the Admin Settings page (slug is immutable after creation)
```

**Rationale:** FR2 only covers onboarding creation. Owners need a post-onboarding path to see and correct their profile details.

---

### Change 2 — Epics: New Story 1.5

**ADD** after Story 1.4 (before `## Epic 2`):

```markdown
### Story 1.5: Restaurant Settings — View & Edit Profile

As a restaurant owner,
I want to view my restaurant name and URL slug in the Admin Settings page and update my restaurant name if needed,
So that I can correct onboarding mistakes and always know my customer-facing URL.

**Acceptance Criteria:**

**Given** an authenticated owner navigates to `/admin/settings`
**When** the page renders
**Then** the current restaurant name is shown in an editable field
**And** the URL slug is shown as read-only, prefixed with the base URL (e.g. `dine-in/blue-plate`)
**And** a note explains that the slug cannot be changed after setup

**Given** an owner edits their restaurant name and clicks "Save"
**When** `updateRestaurantName()` completes
**Then** `restaurants.name` is updated for their restaurant
**And** a success message is shown inline

**Given** an owner submits an empty restaurant name
**When** validation runs
**Then** an inline error is shown and the save is not attempted

**Given** an authenticated owner is on any admin page
**When** the Admin navigation renders
**Then** a "Settings" tab/item is present and navigates to `/admin/settings`
```

---

### Change 3 — AdminNav: Add Settings tab

**File:** `components/admin/AdminNav.tsx`

**OLD tabs array:**
```ts
const tabs = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, exact: false },
  { href: '/admin/tables', label: 'Tables', icon: QrCode, exact: false },
]
```

**NEW tabs array:**
```ts
const tabs = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, exact: false },
  { href: '/admin/tables', label: 'Tables', icon: QrCode, exact: false },
  { href: '/admin/settings', label: 'Settings', icon: Settings, exact: false },
]
```

Import `Settings` from `lucide-react`.

---

### Change 4 — New server action: `updateRestaurantName`

**File:** `actions/restaurantActions.ts`

**ADD** new export:
```ts
export async function updateRestaurantName(name: string): Promise<ActionResult<void>> {
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Restaurant name cannot be empty' }

  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ name: trimmed })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
```

---

### Change 5 — New component: `RestaurantSettings`

**File:** `components/admin/RestaurantSettings.tsx` (new)

Client component with:
- Controlled `name` input (pre-filled from prop)
- Save button → calls `updateRestaurantName(name)` → inline success/error
- Read-only slug display with prefix `dine-in/`
- Password change link to `/auth/update-password`

---

### Change 6 — New page: `/admin/settings`

**File:** `app/admin/settings/page.tsx` (new)

Server component that:
- Fetches `supabase.from('restaurants').select('name, slug').single()`
- Renders `<RestaurantSettings name={restaurant.name} slug={restaurant.slug} />`

---

## Section 5: Implementation Handoff

**Change scope: Minor** — direct implementation by Developer agent.

**Files to create/modify:**
| File | Action |
|------|--------|
| `_bmad-output/planning-artifacts/prd.md` | Add FR43, FR44 |
| `_bmad-output/planning-artifacts/epics.md` | Add Story 1.5 |
| `actions/restaurantActions.ts` | Add `updateRestaurantName` |
| `components/admin/AdminNav.tsx` | Add Settings tab |
| `components/admin/RestaurantSettings.tsx` | Create — form + display |
| `app/admin/settings/page.tsx` | Create — server component |

**Success criteria:**
- [ ] `/admin/settings` shows the restaurant name (editable) and slug (read-only)
- [ ] Saving a new name updates `restaurants.name` and shows inline success
- [ ] Empty name is rejected with inline error (no DB call)
- [ ] Settings tab appears in the bottom nav (mobile) and sidebar (desktop)
- [ ] Settings tab is active/highlighted when on `/admin/settings`
- [ ] All 168 unit tests still pass
