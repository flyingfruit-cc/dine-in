import { createAdminClient } from '@/lib/supabase/admin'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'
import { isOrderStatus } from '@/utils/orderStatus'
import type { OrderItem } from '@/types/app'

function OrderUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-base text-text-primary">
        This page isn&apos;t available right now. Please ask your server.
      </p>
    </div>
  )
}

interface Props {
  params: Promise<{ restaurant_slug: string; table_number: string; order_id: string }>
}

export default async function OrderTrackingPage({ params }: Props) {
  const { restaurant_slug, table_number, order_id } = await params
  if (!/^\d+$/.test(table_number)) return <OrderUnavailable />
  const tableNum = Number(table_number)

  const adminClient = createAdminClient()

  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .select('id, name, slug, is_published')
    .eq('slug', restaurant_slug)
    .single()
  if (restaurantError) console.error('[OrderTrackingPage] restaurants read', restaurantError)
  if (!restaurant || !restaurant.is_published) return <OrderUnavailable />

  const { data: table, error: tableError } = await adminClient
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single()
  if (tableError) console.error('[OrderTrackingPage] tables read', tableError)
  if (!table) return <OrderUnavailable />

  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, status, items, restaurant_id, table_id, submitted_at')
    .eq('id', order_id)
    .single()
  if (orderError) console.error('[OrderTrackingPage] orders read', orderError)
  if (!order) return <OrderUnavailable />

  // Cross-tenant / cross-table guard: prevents URL forgery from reading other tables' orders.
  // The anon view exposes any UUID; this server-side tuple check is the security boundary.
  if (order.restaurant_id !== restaurant.id || order.table_id !== table.id) {
    return <OrderUnavailable />
  }

  if (!isOrderStatus(order.status)) return <OrderUnavailable />

  const rawItems = Array.isArray(order.items) ? (order.items as unknown as OrderItem[]) : []

  return (
    <OrderConfirmationScreen
      orderId={order.id}
      initialStatus={order.status}
      restaurantName={restaurant.name}
      tableNumber={table.number}
      items={rawItems.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        variantNames: Array.isArray(it.variants) ? it.variants : [],
      }))}
    />
  )
}
