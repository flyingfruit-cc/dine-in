import { test, expect } from '@playwright/test'
import {
  getServiceClient,
  createTestRestaurant,
  createTestOwner,
  signInAsOwner,
  cleanupTestRestaurants,
  cleanupTestUsers,
} from './helpers'

/**
 * P0: Platform Admin Access & Privilege Escalation Prevention
 * Verifies:
 * - Platform admin (service role) can read all tenant data
 * - Regular owners cannot set is_platform_admin = true on their own profile
 * - is_platform_admin defaults to false for all new owner profiles
 */
test.describe('Platform Admin Access', () => {
  const svc = getServiceClient()
  const suffix = `padmin-${Date.now()}`
  let restA: { id: string }
  let restB: { id: string }
  let adminUserId: string

  test.beforeAll(async () => {
    restA = await createTestRestaurant(svc, `padmin-rest-a-${suffix}`, 'Admin Test Restaurant A')
    restB = await createTestRestaurant(svc, `padmin-rest-b-${suffix}`, 'Admin Test Restaurant B')
    await createTestOwner(svc, restA.id, `padmin-owner-a-${suffix}@test.invalid`)

    // Create a platform admin user (is_platform_admin set manually via service role — as in prod)
    const { data: { user }, error } = await svc.auth.admin.createUser({
      email: `platform-admin-${suffix}@test.invalid`,
      password: 'Test1234!',
      email_confirm: true,
    })
    if (error || !user) throw new Error(`Failed to create platform admin: ${error?.message}`)
    adminUserId = user.id

    const { error: profileErr } = await svc.from('profiles').insert({
      id: user.id,
      restaurant_id: null,
      is_platform_admin: true,
    })
    if (profileErr) throw new Error(`Failed to insert platform admin profile: ${profileErr.message}`)
  })

  test.afterAll(async () => {
    if (adminUserId) await svc.auth.admin.deleteUser(adminUserId)
    await cleanupTestRestaurants(svc, [restA.id, restB.id])
  })

  test('is_platform_admin is false by default for new owner profiles', async () => {
    const { data, error } = await svc
      .from('profiles')
      .select('is_platform_admin')
      .eq('restaurant_id', restA.id)
    expect(error).toBeNull()
    expect(data?.every(p => p.is_platform_admin === false)).toBe(true)
  })

  test('owner cannot escalate own profile to platform admin via UPDATE', async () => {
    const clientA = await signInAsOwner(`padmin-owner-a-${suffix}@test.invalid`)
    const { data: { user } } = await clientA.auth.getUser()
    const ownerId = user!.id

    // Attempt self-escalation — RLS WITH CHECK blocks writes where is_platform_admin = true
    const { error: escalationError } = await clientA
      .from('profiles')
      .update({ is_platform_admin: true })
      .eq('id', ownerId)
    expect(escalationError).not.toBeNull()

    // Re-read via service role to confirm is_platform_admin was NOT changed
    const { data } = await svc.from('profiles').select('is_platform_admin').eq('id', ownerId).single()
    expect(data?.is_platform_admin).toBe(false)
  })

  test('service role (simulating platform admin) can read all restaurants', async () => {
    const { data, error } = await svc.from('restaurants').select('id').in('id', [restA.id, restB.id])
    expect(error).toBeNull()
    const ids = data?.map(r => r.id) ?? []
    expect(ids).toContain(restA.id)
    expect(ids).toContain(restB.id)
  })

  test('service role can read all profiles regardless of restaurant', async () => {
    const { data, error } = await svc
      .from('profiles')
      .select('id, is_platform_admin')
      .in('id', [adminUserId])
    expect(error).toBeNull()
    expect(data?.[0]?.is_platform_admin).toBe(true)
  })

  test('owner A cannot read platform admin profile via authenticated client', async () => {
    const clientA = await signInAsOwner(`padmin-owner-a-${suffix}@test.invalid`)
    // Owner RLS on profiles is: USING (id = auth.uid()) — owner can only see own profile
    const { data } = await clientA.from('profiles').select('id').eq('id', adminUserId)
    expect(data?.length ?? 0).toBe(0)
  })
})
