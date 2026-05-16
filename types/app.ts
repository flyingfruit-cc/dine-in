// ActionResult: return type for ALL Server Actions — never throw
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// All prices stored as integer cents — 1500 = $15.00
// Use utils/formatPrice.ts for display formatting
export type PriceCents = number

export interface Category {
  id: string
  restaurant_id: string
  name: string
  display_order: number
}

export interface VariantOption {
  id: string
  name: string
  price_cents: number
}

export interface VariantGroup {
  id: string
  name: string
  options: VariantOption[]
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  is_published: boolean
  image_url: string | null
  variants: VariantGroup[]
  created_at: string
}

export interface MenuItemCreate {
  name: string
  description?: string | null
  price_cents: number
  category_id?: string | null
  variants?: VariantGroup[]
}

export interface MenuItemUpdate {
  name?: string
  description?: string | null
  price_cents?: number
  category_id?: string | null
  image_url?: string | null
  variants?: VariantGroup[]
}
