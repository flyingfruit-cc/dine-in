import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  createTestPlatformAdmin,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Platform admin access control', () => {
  const svc = getServiceClient()
  const suffix = `pa-${Date.now()}`
  let restA: { id: string; name: string }
  let restB: { id: string; name: string }
  let adminUserId: string
  const adminEmail = `pa-admin-${suffix}@test.invalid`
  const ownerEmail = `pa-owner-${suffix}@test.invalid`

  test.beforeAll(async () => {
    restA = await createTestRestaurant(svc, `pa-rest-a-${suffix}`, `PA Test Restaurant A ${suffix}`)
    restB = await createTestRestaurant(svc, `pa-rest-b-${suffix}`, `PA Test Restaurant B ${suffix}`)

    await createTestOwner(svc, restA.id, ownerEmail)

    const admin = await createTestPlatformAdmin(svc, adminEmail)
    adminUserId = admin.id
  })

  test.afterAll(async () => {
    // cleanupTestRestaurants sweeps owner profiles + auth users via the restaurant FK cascade.
    await cleanupTestRestaurants(svc, [restA.id, restB.id])
    if (adminUserId) await cleanupTestUsers(svc, [adminUserId])
  })

  async function signIn(page: Page, email: string) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /log in/i }).click()
    // Owners land on /admin; platform admins land on /admin too (login defaults).
    // Waiting for either confirms the auth cookie is committed before the next goto.
    await page.waitForURL(/\/admin/)
  }

  test('platform admin can access tenant list and see registered restaurants', async ({ page }) => {
    await signIn(page, adminEmail)
    await page.goto('/platform/tenants')
    await page.waitForURL(/\/platform\/tenants/)

    // Both test restaurants should be visible
    await expect(page.getByText(`PA Test Restaurant A ${suffix}`)).toBeVisible()
    await expect(page.getByText(`PA Test Restaurant B ${suffix}`)).toBeVisible()

    // Page heading
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()

    // Search input present
    await expect(page.getByPlaceholder(/search by name/i)).toBeVisible()
  })

  test('regular restaurant owner is redirected to /auth/login from /platform', async ({ page }) => {
    await signIn(page, ownerEmail)
    await page.goto('/platform')

    // Layout redirects non-admin to /auth/login. AC#2: redirect target is /auth/login.
    await page.waitForURL((url) => url.pathname === '/auth/login')
    expect(page.url()).toContain('/auth/login')
  })

  test('unauthenticated visitor is redirected to /auth/login from /platform/tenants', async ({ page }) => {
    // Note: a fresh browser context per test — no auth cookie present.
    await page.goto('/platform/tenants')

    await page.waitForURL((url) => url.pathname === '/auth/login')
    expect(page.url()).toContain('/auth/login')
  })
})
