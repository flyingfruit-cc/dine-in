import { test, expect, type Page } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  cleanupTestRestaurants,
} from '../rls/helpers'

const TEST_PASSWORD = 'Test1234!'

test.describe('Menu Publish Flow', () => {
  const svc = getServiceClient()
  const suffix = `pub-${Date.now()}`
  let restaurantId: string
  const ownerEmail = `pub-${suffix}@test.invalid`

  test.beforeAll(async () => {
    const restaurant = await createTestRestaurant(svc, `pub-${suffix}`, 'Publish Test Restaurant')
    restaurantId = restaurant.id
    await createTestOwner(svc, restaurantId, ownerEmail)
  })

  test.afterAll(async () => {
    await cleanupTestRestaurants(svc, [restaurantId])
  })

  async function setPublished(isPublished: boolean) {
    await svc.from('restaurants').update({ is_published: isPublished }).eq('id', restaurantId)
  }

  async function signIn(page: Page) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(ownerEmail)
    await page.getByLabel('Password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /log in/i }).click()
    await page.waitForURL(/\/admin/)
  }

  test.describe('when menu is not published', () => {
    test.beforeEach(async ({ page }) => {
      await setPublished(false)
      await signIn(page)
      await page.goto('/admin/menu')
    })

    test('shows Publish menu button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Publish menu' })).toBeVisible()
      await expect(page.getByText(/Your menu is live/)).not.toBeVisible()
    })

    test('clicking Publish menu shows live banner and Take offline button', async ({ page }) => {
      await page.getByRole('button', { name: 'Publish menu' }).click()
      await expect(page.getByText(/Your menu is live/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Take offline' })).toBeVisible()
    })
  })

  test.describe('when menu is published', () => {
    test.beforeEach(async ({ page }) => {
      await setPublished(true)
      await signIn(page)
      await page.goto('/admin/menu')
    })

    test('shows live banner and Take offline button', async ({ page }) => {
      await expect(page.getByText(/Your menu is live/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Take offline' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Publish menu' })).not.toBeVisible()
    })

    test('clicking Take offline opens confirmation dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Take offline' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Take menu offline?')).toBeVisible()
    })

    test('Cancel closes dialog without taking offline', async ({ page }) => {
      await page.getByRole('button', { name: 'Take offline' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
      await expect(page.getByText(/Your menu is live/)).toBeVisible()
    })

    test('confirming Take offline shows Publish menu button', async ({ page }) => {
      await page.getByRole('button', { name: 'Take offline' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Take offline' }).click()
      await expect(page.getByRole('button', { name: 'Publish menu' })).toBeVisible()
      await expect(page.getByText(/Your menu is live/)).not.toBeVisible()
    })
  })
})
