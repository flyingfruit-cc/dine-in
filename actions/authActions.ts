'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidSlugFormat } from '@/utils/validateSlug'
import type { ActionResult } from '@/types/app'

export async function createRestaurant(input: {
  name: string
  slug: string
}): Promise<ActionResult<{ restaurantId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Server-side validation — client-side can be bypassed
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!name) return { success: false, error: 'Restaurant name is required' }
  if (!isValidSlugFormat(slug)) {
    return {
      success: false,
      code: 'SLUG_INVALID',
      error: 'Slug must be 3–50 lowercase letters, numbers, or hyphens with no leading, trailing, or consecutive hyphens',
    }
  }

  // Guard: block if user already has a restaurant (prevents orphaned duplicates)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()
  if (existingProfile?.restaurant_id) {
    return { success: false, error: 'Your account already has a restaurant' }
  }

  // Admin client required: no user-level INSERT policy on restaurants,
  // and new user's RLS filters all restaurants to zero rows
  const admin = createAdminClient()

  // Rely on unique constraint (23505) instead of a pre-check — eliminates TOCTOU race
  const { data: restaurant, error: insertError } = await admin
    .from('restaurants')
    .insert({ name, slug })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, code: 'SLUG_TAKEN', error: 'This URL is already in use — try another' }
    }
    return { success: false, error: insertError.message }
  }
  if (!restaurant) {
    return { success: false, error: 'Failed to create restaurant' }
  }

  // Link restaurant to profile; verify a row was actually updated
  const { data: updatedProfile, error: profileError } = await supabase
    .from('profiles')
    .update({ restaurant_id: restaurant.id })
    .eq('id', user.id)
    .select('id')
    .single()

  if (profileError || !updatedProfile) {
    // Compensating delete — don't leave an orphaned restaurant row
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    return {
      success: false,
      error: profileError?.message ?? 'Failed to link restaurant to profile',
    }
  }

  return { success: true, data: { restaurantId: restaurant.id } }
}
