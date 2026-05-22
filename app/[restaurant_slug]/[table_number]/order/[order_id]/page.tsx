import { createAdminClient } from '@/lib/supabase/admin'
import { OrderConfirmationScreen } from '@/components/customer/OrderConfirmationScreen'
import { isOrderStatus } from '@/utils/orderStatus'
import { resolveLanguage } from '@/utils/resolveLanguage'
import { loadI18nBundle } from '@/utils/loadI18nBundle'
import type { OrderItem } from '@/types/app'

function OrderUnavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-base text-text-primary">{message}</p>
    </div>
  )
}

interface Props {
  params: Promise<{ restaurant_slug: string; table_number: string; order_id: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function OrderTrackingPage({ params, searchParams }: Props) {
  const [{ restaurant_slug, table_number, order_id }, { lang: urlLang }] = await Promise.all([
    params,
    searchParams,
  ])

  const fallbackBundle = loadI18nBundle('en')
  if (!/^\d+$/.test(table_number)) {
    return <OrderUnavailable message={fallbackBundle['order.unavailable']} />
  }
  const tableNum = Number(table_number)

  const adminClient = createAdminClient()

  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .select('id, name, slug, is_published, supported_languages, default_language')
    .eq('slug', restaurant_slug)
    .single()
  if (restaurantError) console.error('[OrderTrackingPage] restaurants read', restaurantError)
  if (!restaurant || !restaurant.is_published) {
    return <OrderUnavailable message={fallbackBundle['order.unavailable']} />
  }

  const supportedLanguages = (restaurant.supported_languages as string[] | null) ?? ['en']
  const defaultLanguage = (restaurant.default_language as string | null) ?? 'en'
  const lang = resolveLanguage({
    urlLang,
    supportedLanguages,
    defaultLanguage,
  })
  const chrome = loadI18nBundle(lang)

  const { data: table, error: tableError } = await adminClient
    .from('tables')
    .select('id, number')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single()
  if (tableError) console.error('[OrderTrackingPage] tables read', tableError)
  if (!table) return <OrderUnavailable message={chrome['order.unavailable']} />

  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, status, items, restaurant_id, table_id, submitted_at')
    .eq('id', order_id)
    .single()
  if (orderError) console.error('[OrderTrackingPage] orders read', orderError)
  if (!order) return <OrderUnavailable message={chrome['order.unavailable']} />

  if (order.restaurant_id !== restaurant.id || order.table_id !== table.id) {
    return <OrderUnavailable message={chrome['order.unavailable']} />
  }

  if (!isOrderStatus(order.status)) return <OrderUnavailable message={chrome['order.unavailable']} />

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
        translations: it.translations,
      }))}
      lang={lang}
      chrome={chrome}
    />
  )
}
