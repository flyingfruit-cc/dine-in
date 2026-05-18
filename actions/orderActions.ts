'use server'

// Client-selection rules: see docs/conventions/supabase-clients.md
// Reads use the admin client (RLS-bypassed lookups); the INSERT uses the
// customer's session client so customer_insert_order RLS validates JWT claims.
// The INSERT deliberately omits .select() — RETURNING + missing SELECT policy
// for the anonymous customer triggers a 42501 that masquerades as a WITH CHECK failure.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, CartItem } from '@/types/app'

export interface SubmitOrderData {
  restaurantName: string
  tableNumber: number
}

export async function submitOrder(cartItems: CartItem[]): Promise<ActionResult<SubmitOrderData>> {
  if (cartItems.length === 0) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.is_anonymous !== true) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const { restaurant_id: restaurantId, table_number: tableNumber } = user.app_metadata as {
    restaurant_id: string
    table_number: number
  }

  const adminClient = createAdminClient()
  const [
    { data: tableData, error: tableError },
    { data: restaurantData, error: restaurantError },
  ] = await Promise.all([
    adminClient.from('tables').select('id').eq('restaurant_id', restaurantId).eq('number', tableNumber).single(),
    adminClient.from('restaurants').select('name').eq('id', restaurantId).single(),
  ])

  if (tableError || !tableData || restaurantError || !restaurantData) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  const map = new Map<string, { name: string; quantity: number; variants: string[] }>()
  for (const item of cartItems) {
    const variantKey = item.selectedVariants.map((v) => `${v.groupId}:${v.optionId}`).sort().join(',')
    const key = `${item.menuItemId}:${variantKey}`
    const existing = map.get(key)
    if (existing) {
      existing.quantity++
    } else {
      map.set(key, {
        name: item.name,
        quantity: 1,
        variants: item.selectedVariants.map((v) => v.optionName),
      })
    }
  }
  const items = Array.from(map.values())

  const { error: insertError } = await supabase
    .from('orders')
    .insert({ restaurant_id: restaurantId, table_id: tableData.id, items, is_handled: false })

  if (insertError) {
    return { success: false, error: "Tap to try again — your order hasn't been sent" }
  }

  return {
    success: true,
    data: {
      restaurantName: restaurantData.name,
      tableNumber,
    },
  }
}
