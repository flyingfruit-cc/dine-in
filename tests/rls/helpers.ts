import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../../types/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_PASSWORD = 'Test1234!'

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY'
  )
}

export function getServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function createTestRestaurant(
  serviceClient: SupabaseClient<Database>,
  slug: string,
  name: string
) {
  const { data, error } = await serviceClient
    .from('restaurants')
    .insert({ slug, name })
    .select()
    .single()
  if (error) throw new Error(`createTestRestaurant failed: ${error.message}`)
  return data
}

export async function createTestOwner(
  serviceClient: SupabaseClient<Database>,
  restaurantId: string,
  email: string
) {
  const { data: { user }, error } = await serviceClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error || !user) throw new Error(`createTestOwner failed: ${error?.message}`)

  const { error: profileError } = await serviceClient
    .from('profiles')
    .upsert({ id: user.id, restaurant_id: restaurantId, is_platform_admin: false })
  if (profileError) throw new Error(`createTestOwner profile failed: ${profileError.message}`)

  return user
}

export async function signInAsOwner(email: string): Promise<SupabaseClient<Database>> {
  const client = getAnonClient()
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) throw new Error(`signInAsOwner failed: ${error.message}`)
  return client
}

/**
 * Creates an anonymous customer client scoped to a restaurant + table.
 * Requires custom_access_token_hook to be registered in Supabase Dashboard
 * (Authentication → Hooks → Custom Access Token → public.custom_access_token_hook).
 */
export async function createAnonCustomerClient(
  serviceClient: SupabaseClient<Database>,
  restaurantId: string,
  tableNumber: number
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = getAnonClient()

  // 1. Sign in anonymously — creates a fresh anonymous user
  const { data: { session }, error: signInError } = await client.auth.signInAnonymously()
  if (signInError || !session) throw new Error(`signInAnonymously failed: ${signInError?.message}`)

  const userId = session.user.id

  // 2. Attach restaurant + table to the user's app_metadata via admin API
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    app_metadata: { restaurant_id: restaurantId, table_number: tableNumber },
  })
  if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`)

  // 3. Refresh session — hook injects updated app_metadata into the new JWT
  const { data: { session: refreshed }, error: refreshError } = await client.auth.refreshSession()
  if (refreshError || !refreshed) throw new Error(`refreshSession failed: ${refreshError?.message}`)

  return { client, userId }
}

export async function cleanupTestUsers(
  serviceClient: SupabaseClient<Database>,
  userIds: string[]
) {
  for (const id of userIds) {
    const { error } = await serviceClient.auth.admin.deleteUser(id)
    if (error) console.warn(`cleanupTestUsers: failed to delete user ${id}: ${error.message}`)
  }
}

export async function cleanupTestRestaurants(
  serviceClient: SupabaseClient<Database>,
  restaurantIds: string[]
) {
  // FK cascade handles child rows; delete in correct order
  for (const id of restaurantIds) {
    const { error: ordErr } = await serviceClient.from('orders').delete().eq('restaurant_id', id)
    if (ordErr) console.warn(`cleanupTestRestaurants: orders delete failed for ${id}: ${ordErr.message}`)
    const { error: tblErr } = await serviceClient.from('tables').delete().eq('restaurant_id', id)
    if (tblErr) console.warn(`cleanupTestRestaurants: tables delete failed for ${id}: ${tblErr.message}`)
    const { error: miErr } = await serviceClient.from('menu_items').delete().eq('restaurant_id', id)
    if (miErr) console.warn(`cleanupTestRestaurants: menu_items delete failed for ${id}: ${miErr.message}`)
    const { error: catErr } = await serviceClient.from('categories').delete().eq('restaurant_id', id)
    if (catErr) console.warn(`cleanupTestRestaurants: categories delete failed for ${id}: ${catErr.message}`)
    // Profiles FK to auth.users — delete auth users first (cascade removes profiles)
  }
  // Delete owner auth users (cascades to profiles)
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id')
    .in('restaurant_id', restaurantIds)
  if (profiles?.length) {
    await cleanupTestUsers(serviceClient, profiles.map(p => p.id))
  }
  const { error: restErr } = await serviceClient.from('restaurants').delete().in('id', restaurantIds)
  if (restErr) console.warn(`cleanupTestRestaurants: restaurants delete failed: ${restErr.message}`)
}
