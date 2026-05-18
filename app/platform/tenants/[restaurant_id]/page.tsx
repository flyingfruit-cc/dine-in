import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice } from '@/utils/formatPrice'
import { generateQrUrl } from '@/utils/generateQrUrl'
import type { OrderItem } from '@/types/app'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function TenantDetailPage({
  params,
}: {
  params: { restaurant_id: string }
}) {
  const { restaurant_id: restaurantId } = params
  if (!UUID_RE.test(restaurantId)) notFound()

  const supabase = createAdminClient()

  const [
    { data: restaurant },
    { data: ownerProfile },
    { data: tables },
    { data: menuItems },
    { data: orders },
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, slug, created_at, is_published')
      .eq('id', restaurantId)
      .single(),
    supabase
      .from('profiles')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    supabase
      .from('tables')
      .select('id, number, created_at')
      .eq('restaurant_id', restaurantId)
      .order('number'),
    supabase
      .from('menu_items')
      .select('id, name, price_cents')
      .eq('restaurant_id', restaurantId)
      .order('name'),
    supabase
      .from('orders')
      .select('id, submitted_at, is_handled, items')
      .eq('restaurant_id', restaurantId)
      .order('submitted_at', { ascending: false })
      .limit(20),
  ])

  if (!restaurant) notFound()

  let ownerEmail = '—'
  if (ownerProfile?.id) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      ownerProfile.id
    )
    if (!userError && userData?.user?.email) ownerEmail = userData.user.email
  }

  const tableList = tables ?? []
  const itemList = menuItems ?? []
  const orderList = orders ?? []

  return (
    <main className="p-6 max-w-4xl">
      <Link href="/platform/tenants" className="text-sm text-accent hover:underline">
        ← Tenants
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">{restaurant.name}</h1>
        <p className="text-sm text-text-secondary font-mono">{restaurant.slug}</p>
      </div>

      {/* Summary card */}
      <section className="mb-8 rounded-lg border border-border bg-surface-raised p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">Account Summary</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-secondary">Owner email</dt>
            <dd className="text-text-primary">{ownerEmail}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Signed up</dt>
            <dd className="text-text-primary">
              {new Date(restaurant.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Status</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  restaurant.is_published
                    ? 'bg-accent text-white'
                    : 'bg-border text-text-secondary'
                }`}
              >
                {restaurant.is_published ? 'Published' : 'Offline'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Tables</dt>
            <dd className="text-text-primary">{tableList.length}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Menu items</dt>
            <dd className="text-text-primary">{itemList.length}</dd>
          </div>
        </dl>
      </section>

      {/* Tables */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          Tables ({tableList.length})
        </h2>
        {tableList.length === 0 ? (
          <p className="text-sm text-text-secondary">No tables configured.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tableList.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-semibold text-text-primary">Table {t.number}</span>
                <span className="font-mono text-xs text-text-secondary break-words">
                  {generateQrUrl(restaurant.slug, t.number)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Menu Items */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          Menu Items ({itemList.length})
        </h2>
        {itemList.length === 0 ? (
          <p className="text-sm text-text-secondary">No menu items.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {itemList.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-text-primary">{item.name}</span>
                <span className="text-sm text-text-secondary shrink-0">
                  {formatPrice(item.price_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Orders */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          Recent Orders (last {orderList.length})
        </h2>
        {orderList.length === 0 ? (
          <p className="text-sm text-text-secondary">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {orderList.map((order) => {
              const rawItems = order.items as unknown
              const items: OrderItem[] = Array.isArray(rawItems)
                ? (rawItems as OrderItem[]).filter((i) => i && typeof i.name === 'string' && i.name)
                : []
              const summary =
                items
                  .map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name))
                  .join(', ') || 'No items'
              return (
                <li key={order.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm text-text-primary">{summary}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(order.submitted_at).toLocaleDateString()}{' '}
                      {new Date(order.submitted_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      order.is_handled
                        ? 'bg-border text-text-secondary'
                        : 'bg-accent text-white'
                    }`}
                  >
                    {order.is_handled ? 'Handled' : 'Pending'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
