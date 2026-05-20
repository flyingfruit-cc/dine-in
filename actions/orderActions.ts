'use server'

// Client-selection rules: see docs/conventions/supabase-clients.md
// Sessionless customer flow: validation lives in this Server Action, not in RLS.
// The admin client is used both for lookups and for the final INSERT.
// Customer-facing RLS policies remain in the DB as dormant defense-in-depth.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, CartItem } from '@/types/app'

export interface SubmitOrderData {
  restaurantName: string
  tableNumber: number
}

export interface SubmitOrderInput {
  restaurantSlug: string
  tableNumber: number
  cartItems: CartItem[]
}

const RETRY_ERROR = "Tap to try again — your order hasn't been sent"

export async function submitOrder({
  restaurantSlug,
  tableNumber,
  cartItems,
}: SubmitOrderInput): Promise<ActionResult<SubmitOrderData>> {
  if (cartItems.length === 0) {
    return { success: false, error: RETRY_ERROR }
  }
  if (!restaurantSlug || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    return { success: false, error: RETRY_ERROR }
  }

  const adminClient = createAdminClient()

  const { data: restaurant, error: restError } = await adminClient
    .from('restaurants')
    .select('id, name')
    .eq('slug', restaurantSlug)
    .single()

  if (restError || !restaurant) {
    return { success: false, error: RETRY_ERROR }
  }

  const { data: table, error: tableError } = await adminClient
    .from('tables')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNumber)
    .single()

  if (tableError || !table) {
    return { success: false, error: RETRY_ERROR }
  }

  const map = new Map<string, { name: string; quantity: number; variants: string[]; unit_price_cents: number }>()
  for (const item of cartItems) {
    const variantKey = item.selectedVariants
      .map((v) => `${v.groupId}:${v.optionId}`)
      .sort()
      .join(',')
    const key = `${item.menuItemId}:${variantKey}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity++
    } else {
      map.set(key, {
        name: item.name,
        quantity: 1,
        variants: item.selectedVariants.map((v) => v.optionName),
        unit_price_cents: item.price_cents,
      })
    }
  }
  const items = Array.from(map.values())
  const total_cents = items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0)

  const { error: insertError } = await adminClient
    .from('orders')
    .insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      items,
      total_cents,
      is_handled: false,
    })

  if (insertError) {
    return { success: false, error: RETRY_ERROR }
  }

  return {
    success: true,
    data: {
      restaurantName: restaurant.name,
      tableNumber,
    },
  }
}

export async function markOrderHandled(orderId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // No .select() after UPDATE — avoids 42501/RETURNING issue (see docs/conventions/supabase-clients.md)
  // owner_update_orders RLS policy gates by restaurant_id = get_my_restaurant_id()
  // is_handled=false guard makes the UPDATE idempotent: a double-tap can't overwrite handled_at.
  const { error } = await supabase
    .from('orders')
    .update({ is_handled: true, handled_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('is_handled', false)

  if (error) {
    console.error('[markOrderHandled]', error)
    return { success: false, error: 'Failed to mark order as handled' }
  }
  return { success: true, data: undefined }
}
