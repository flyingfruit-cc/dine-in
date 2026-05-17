# Test Automation Summary — Menu Publish/Offline Flow

**Date:** 2026-05-17

## Generated Tests

### E2E Tests
- [x] `tests/e2e/menu-publish.spec.ts` — Menu publish/offline browser flow (6 tests)

### Bug Fixes
- [x] `tests/rls/helpers.ts` — Fixed `createTestOwner` to use `upsert` instead of `insert` to handle the `handle_new_user` trigger that auto-creates profiles on user signup

## Test Coverage

### E2E Tests — Menu Publish Flow (`tests/e2e/menu-publish.spec.ts`)

**When menu is not published:**
- [x] Shows "Publish menu" button and no live banner
- [x] Clicking "Publish menu" shows live banner and "Take offline" button

**When menu is published:**
- [x] Shows live banner and "Take offline" button, no "Publish menu" button
- [x] Clicking "Take offline" opens confirmation dialog with correct text
- [x] Clicking "Cancel" closes dialog without taking offline
- [x] Confirming "Take offline" hides live banner and shows "Publish menu" button

## Test Run Results

```
6 tests using 1 worker
6 passed (13.0s)
```

All 168 existing unit tests continue to pass (19 test files).

## Test Setup

Each test run:
1. Creates an isolated test restaurant + owner via Supabase service role
2. Sets `is_published` state via service client before each test
3. Signs in via the browser login form
4. Navigates to `/admin/menu` to exercise the UI
5. Cleans up all test data in `afterAll`

**Prerequisite:** Next.js dev server running at `http://localhost:3000`

## Coverage Summary

| Feature | Unit Tests | E2E Tests |
|---------|-----------|-----------|
| `MenuPublishToggle` component | ✅ 9 tests (existing) | ✅ 6 tests (new) |
| `restaurantActions` (publish/offline/preview) | ✅ 12 tests (existing) | — |
| `OnboardingChecklist` component | ❌ Not covered | — |
| RLS for `is_published` / `has_previewed_menu` | — | ❌ Not covered |

## Next Steps

- Add unit tests for `OnboardingChecklist` component (all prop combinations)
- Add RLS tests verifying only the restaurant owner can update `is_published` and `has_previewed_menu`
- Add `webServer` config to `playwright.config.ts` to auto-start the dev server in CI
