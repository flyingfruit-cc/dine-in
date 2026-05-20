// ActionResult: return type for ALL Server Actions — never throw
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// All prices stored as integer cents — 1500 = $15.00
// Use utils/formatPrice.ts for display formatting
export type PriceCents = number

export interface Restaurant {
  id: string
  slug: string
  name: string
  is_published: boolean
  has_previewed_menu: boolean
  has_printed_qr: boolean
  created_at: string
}

export interface Table {
  id: string
  restaurant_id: string
  number: number
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  display_order: number
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface AvailabilitySchedule {
  days: DayOfWeek[]
  start_time: string  // "HH:MM" 24-hour
  end_time: string    // "HH:MM" 24-hour; half-open [start, end) — overnight not supported
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
  image_url: string | null
  display_order: number
  variants: VariantGroup[]
  availability_schedule: AvailabilitySchedule | null
  created_at: string
}

export interface MenuItemCreate {
  name: string
  description?: string | null
  price_cents: number
  category_id?: string | null
  variants?: VariantGroup[]
  availability_schedule?: AvailabilitySchedule | null
}

export interface MenuItemUpdate {
  name?: string
  description?: string | null
  price_cents?: number
  category_id?: string | null
  image_url?: string | null
  display_order?: number
  variants?: VariantGroup[]
  availability_schedule?: AvailabilitySchedule | null
}

export interface SelectedVariant {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  price_cents: number
}

export interface CartItem {
  cartItemId: string
  menuItemId: string
  name: string
  price_cents: number
  selectedVariants: SelectedVariant[]
}

export type EnrichedMenuItem = MenuItem & { isAvailable: boolean }

export interface OrderItem {
  name: string
  quantity: number
  variants: string[]
  unit_price_cents: number
}

export interface Order {
  id: string
  restaurant_id: string
  table_id: string
  items: OrderItem[]
  submitted_at: string
  is_handled: boolean
  handled_at: string | null
  total_cents: number
}

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d'

export interface OrdersByDay {
  day: string          // ISO date "YYYY-MM-DD" (UTC)
  count: number
  revenueCents: number
}

export interface OrdersByDowHour {
  dow: number          // 0–6, Sun=0 (UTC)
  hour: number         // 0–23 (UTC)
  count: number
}

export interface TopItem {
  name: string
  quantity: number
  revenueCents: number
  variants: Record<string, number>  // variant-label -> count
}

export interface AnalyticsData {
  period: AnalyticsPeriod
  periodStart: string            // ISO
  periodEnd: string              // ISO
  orderCount: number
  totalRevenueCents: number
  averageOrderValueCents: number // 0 when orderCount === 0
  ordersByDay: OrdersByDay[]
  ordersByDowHour: OrdersByDowHour[]
  topItems: TopItem[]
  emptyState: boolean            // true when orderCount < 30 OR error occurred
  error?: boolean                // true when RPC failed — distinguishes outage from "no data"
}
