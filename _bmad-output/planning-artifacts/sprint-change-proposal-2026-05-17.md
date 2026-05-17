# Sprint Change Proposal — Admin Navigation Shell
**Date:** 2026-05-17
**Scope:** Minor — direct implementation by Developer agent

---

## Section 1: Issue Summary

**Problem statement:**
From `/admin/menu`, users have no way to return to `/admin` (the dashboard) to continue their onboarding. After publishing the menu, the `OnboardingChecklist` on `/admin` is the canonical guide to next steps ("Create tables →", "Print QR codes →"), but there is no persistent navigation element in the admin UI to get back there.

**When discovered:**
Identified after Story 2-7 (Menu Publish, Offline Control & Onboarding Checklist) was marked done and the flow was walked end-to-end. The OnboardingChecklist links users to `/admin/menu` to publish, but once there, there is no path back to `/admin` without manually editing the URL.

**Evidence:**
- `app/admin/layout.tsx` is a pure auth guard (`<>{children}</>` — no UI shell)
- All admin pages are isolated with no shared navigation
- Onboarding step 3 ("Publish menu → /admin/menu") and step 4 ("Create tables → /admin/tables") require users to return to `/admin` between steps to see the checklist and click the next CTA

---

## Section 2: Impact Analysis

**Epic impact:**
- Epic 2 (Menu Building & Publishing) — Story 2-7 is marked done, but the onboarding flow it implements is blocked in practice due to missing navigation
- Epic 3 (Table Management) — About to start; `app/admin/tables` will have the same problem immediately on first implementation

**Story impact:**
- Story 2-7 (done) — technically complete per its ACs, but the broader onboarding UX it contributes to is broken
- Story 3.1+ — will silently inherit the problem unless nav is in place first

**Artifact conflicts:**
- UX spec already specifies this component (UX-DR15, UX-DR11) — no spec change needed
- Architecture already designates `app/admin/layout.tsx` as the nav shell location — no arch change needed
- Epics need a minor acknowledgement that nav shell was pulled forward

**Technical impact:**
- `app/admin/layout.tsx` needs a UI shell added (currently zero lines of JSX output)
- No database changes; no new actions; no new API surface
- The Realtime subscription (also designated for `app/admin/layout.tsx` by the architecture) is Epic 5 scope — not included here

---

## Section 3: Recommended Approach

**Direct Adjustment — implement the spec-aligned admin nav shell now.**

Rationale:
1. The UX spec already defines the component in full (UX-DR15, UX-DR11) — this is not a new design decision
2. Epic 3 (Tables) is the next story; adding nav now means `/admin/tables` slots in correctly without a second pass
3. A minimal "back link" patch would need to be replaced anyway when the full nav lands in Epic 5
4. Effort is low: the layout file is the single touch point

**What is in scope (now):**
- Bottom tab bar on mobile: `Dashboard · Menu · Tables` (Orders deferred to Epic 5)
- Left sidebar on desktop: same sections
- Active state highlights the current section
- Dashboard tab links to `/admin`; Menu to `/admin/menu`; Tables to `/admin/tables` (placeholder — page not yet built)

**What stays deferred (Epic 5 scope):**
- Orders tab / sidebar item (no order feed yet)
- Settings tab / sidebar item
- Realtime subscription wired into the layout
- Full UX-DR15 compliance (safe area insets, dark mode for order feed)

**Effort estimate:** 2–3 hours
**Risk:** Low — isolated to `app/admin/layout.tsx`, no data layer changes
**Timeline impact:** None — can be implemented before starting Epic 3

---

## Section 4: Detailed Change Proposals

### Change 1 — `app/admin/layout.tsx`

**OLD:**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  return <>{children}</>
}
```

**NEW:**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.restaurant_id) redirect('/auth/onboarding')

  return (
    <div className="min-h-screen">
      <AdminNav />
      <div className="pb-16 lg:pl-56 lg:pb-0">
        {children}
      </div>
    </div>
  )
}
```

**Rationale:** Wraps children with the `AdminNav` shell and provides bottom-padding on mobile (for the fixed tab bar) and left-padding on desktop (for the fixed sidebar).

---

### Change 2 — `components/admin/AdminNav.tsx` (new file)

**NEW:**
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UtensilsCrossed, QrCode } from 'lucide-react'

const tabs = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed, exact: false },
  { href: '/admin/tables', label: 'Tables', icon: QrCode, exact: false },
]

export function AdminNav() {
  const pathname = usePathname()

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-raised lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Admin navigation"
      >
        <div className="flex">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                  active ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <nav
        className="fixed left-0 top-0 hidden h-full w-56 flex-col border-r border-border bg-surface-raised lg:flex"
        aria-label="Admin navigation"
      >
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
            dine-in
          </p>
        </div>
        <div className="flex flex-col gap-1 p-2">
          {tabs.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
```

**Rationale:** `'use client'` to access `usePathname()` for active state. Tabs include Dashboard, Menu, Tables — aligned with UX-DR15. Orders and Settings are deferred to Epic 5. Desktop sidebar is fixed at 56 (224px), matching the `lg:pl-56` padding applied to `children` in the layout.

---

### Change 3 — Epic 2 story note (epics.md)

**Section:** Story 2.7 Acceptance Criteria — add a note

**ADD** after the last AC in Story 2.7:

```
**AC5** — Admin navigation shell:
Given an owner is on any admin page
Then a persistent navigation element is visible (bottom tab bar on mobile, left sidebar on desktop)
And tabs for Dashboard, Menu, and Tables are present with active-state highlighting
And clicking Dashboard navigates to /admin
And clicking Menu navigates to /admin/menu
```

**Rationale:** The nav shell is a prerequisite for the onboarding flow to be walkable. Adding it to 2-7's scope keeps it within Epic 2 (menu setup / onboarding) where it belongs, rather than floating as an untracked task.

---

## Section 5: Implementation Handoff

**Change scope: Minor** — direct implementation by Developer agent.

**Handoff recipient:** Developer agent

**Files to create/modify:**
| File | Action |
|------|--------|
| `app/admin/layout.tsx` | Modify — add `AdminNav` import and layout wrapper |
| `components/admin/AdminNav.tsx` | Create — mobile bottom tab bar + desktop sidebar |
| `_bmad-output/planning-artifacts/epics.md` | Minor update — add AC5 to Story 2.7 |

**Success criteria:**
- [ ] Navigating to `/admin/menu` shows the nav bar (bottom on mobile, sidebar on desktop)
- [ ] Dashboard tab is highlighted when on `/admin`; Menu tab when on `/admin/menu` or `/admin/menu/*`
- [ ] Tables tab is present (links to `/admin/tables` — page not yet built, OK to land on 404 for now)
- [ ] Existing admin pages render correctly with the added padding/offset
- [ ] No regression in unit tests (`npm test` passes)
- [ ] E2E publish-flow tests still pass (`npx playwright test tests/e2e/menu-publish.spec.ts`)

**Not in scope:**
- Orders tab / Settings tab
- Realtime subscription in layout
- Dark mode for nav (admin is light mode per spec)
- Any changes to customer-facing routes
