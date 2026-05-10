// ActionResult: return type for ALL Server Actions — never throw
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// All prices stored as integer cents — 1500 = $15.00
// Use utils/formatPrice.ts for display formatting
export type PriceCents = number
