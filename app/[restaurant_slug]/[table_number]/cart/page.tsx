import { createAdminClient } from '@/lib/supabase/admin'
import { CartPageClient } from '@/components/customer/CartPageClient'
import { resolveLanguage } from '@/utils/resolveLanguage'
import { loadI18nBundle } from '@/utils/loadI18nBundle'

interface Props {
  params: Promise<{ restaurant_slug: string; table_number: string }>
  searchParams: Promise<{ lang?: string }>
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-base text-text-primary">{message}</p>
    </div>
  )
}

export default async function CartPage({ params, searchParams }: Props) {
  const [{ restaurant_slug, table_number }, { lang: urlLang }] = await Promise.all([
    params,
    searchParams,
  ])

  const fallbackBundle = loadI18nBundle('en')
  if (!/^\d+$/.test(table_number)) {
    return <Unavailable message={fallbackBundle['menu.unavailable']} />
  }

  const adminClient = createAdminClient()
  const { data: restaurant } = await adminClient
    .from('restaurants')
    .select('id, is_published, supported_languages, default_language')
    .eq('slug', restaurant_slug)
    .single()

  if (!restaurant || !restaurant.is_published) {
    return <Unavailable message={fallbackBundle['menu.unavailable']} />
  }

  const supportedLanguages = (restaurant.supported_languages as string[] | null) ?? ['en']
  const defaultLanguage = (restaurant.default_language as string | null) ?? 'en'
  const lang = resolveLanguage({
    urlLang,
    supportedLanguages,
    defaultLanguage,
  })
  const chrome = loadI18nBundle(lang)

  return (
    <CartPageClient
      restaurantSlug={restaurant_slug}
      tableNumber={table_number}
      lang={lang}
      chrome={chrome}
      defaultLanguage={defaultLanguage}
    />
  )
}
