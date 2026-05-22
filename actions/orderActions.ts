'use server'

// Client-selection rules: see docs/conventions/supabase-clients.md
// Sessionless customer flow: validation lives in this Server Action, not in RLS.
// The admin client is used both for lookups and for the final INSERT.
// Customer-facing RLS policies remain in the DB as dormant defense-in-depth.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, CartItem, OrderStatus } from '@/types/app'

export interface SubmitOrderData {
  id: string
  restaurantName: string
  tableNumber: number
}

export interface SubmitOrderInput {
  restaurantSlug: string
  tableNumber: number
  cartItems: CartItem[]
}

const RETRY_ERROR = "Tap to try again — your order hasn't been sent"

const VALID_NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
}

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

  const map = new Map<string, { name: string; quantity: number; variants: string[]; unit_price_cents: number; translations?: Record<string, { name: string; description?: string }> }>()
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
        translations: item.translations,
      })
    }
  }
  const items = Array.from(map.values())
  const total_cents = items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0)

  // Admin client: .select() after INSERT is allowed here — admin client uses the
  // service role, which bypasses the 42501 RETURNING trap that applies to anon writes.
  const { data: inserted, error: insertError } = await adminClient
    .from('orders')
    .insert({
      restaurant_id: restaurant.id,
      table_id: table.id,
      items,
      total_cents,
      is_handled: false,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: RETRY_ERROR }
  }

  if (!inserted) {
    console.error('[submitOrder] insert succeeded but row read failed')
    return { success: false, error: RETRY_ERROR }
  }

  return {
    success: true,
    data: {
      id: inserted.id,
      restaurantName: restaurant.name,
      tableNumber,
    },
  }
}

export async function unbumpOrder(orderId: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: current, error: readError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()
  if (readError || !current) {
    return { success: false, error: 'Order not found', code: 'NOT_FOUND' }
  }

  if ((current.status as OrderStatus) !== 'ready') {
    return { success: false, error: 'Invalid status transition', code: 'INVALID_TRANSITION' }
  }

  // Reverse transition: ready → preparing. Atomic with is_handled/handled_at reset.
  const { error, count } = await supabase
    .from('orders')
    .update({ status: 'preparing', is_handled: false, handled_at: null }, { count: 'exact' })
    .eq('id', orderId)
    .eq('status', 'ready')

  if (error) {
    console.error('[unbumpOrder]', error)
    return { success: false, error: "Tap to retry — undo didn't send", code: 'UPDATE_FAILED' }
  }
  if (count === 0) {
    return { success: false, error: 'Order changed — please refresh', code: 'CONCURRENT_UPDATE' }
  }
  return { success: true, data: undefined }
}

export async function advanceOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<ActionResult<void>> {
  // Runtime guard: nextStatus must be a real OrderStatus and never 'received'
  // (received is only ever a starting state, never a destination).
  if (
    !nextStatus ||
    !(nextStatus in VALID_NEXT_STATUS) ||
    nextStatus === 'received'
  ) {
    return { success: false, error: 'Invalid status transition', code: 'INVALID_TRANSITION' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  // Read the current status under RLS — owner_select_orders gates by restaurant_id.
  // PGRST116 = "no rows returned"; any other readError is a real DB failure.
  const { data: current, error: readError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()
  if (readError || !current) {
    return { success: false, error: 'Order not found', code: 'NOT_FOUND' }
  }

  const currentStatus = current.status as OrderStatus
  if (VALID_NEXT_STATUS[currentStatus] !== nextStatus) {
    return { success: false, error: 'Invalid status transition', code: 'INVALID_TRANSITION' }
  }

  // Optimistic-concurrency filter: status must still match what we read,
  // otherwise a concurrent Realtime echo could let two advances stack.
  // count: 'exact' lets us detect 0-row matches (concurrent advance / row deleted)
  // without chaining .select() on the JS query.
  const payload: { status: OrderStatus; is_handled?: boolean; handled_at?: string } = {
    status: nextStatus,
  }
  if (nextStatus === 'completed') {
    payload.is_handled = true
    payload.handled_at = new Date().toISOString()
  }

  const { error, count } = await supabase
    .from('orders')
    .update(payload, { count: 'exact' })
    .eq('id', orderId)
    .eq('status', currentStatus)

  if (error) {
    console.error('[advanceOrderStatus]', error)
    return { success: false, error: 'Failed to update order — tap to retry', code: 'UPDATE_FAILED' }
  }
  if (count === 0) {
    // Optimistic-concurrency filter matched 0 rows: status moved between read and write,
    // row was deleted, or RLS denied the write. UI should refresh to reconcile.
    return { success: false, error: 'Order changed — please refresh', code: 'CONCURRENT_UPDATE' }
  }
  return { success: true, data: undefined }
}
