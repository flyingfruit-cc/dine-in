'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/app'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, restaurantId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .single()

  return { supabase, user, restaurantId: profile?.restaurant_id ?? null }
}

export async function publishMenu(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ is_published: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function takeMenuOffline(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ is_published: false })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function updateRestaurantName(name: string): Promise<ActionResult<void>> {
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Restaurant name cannot be empty' }

  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ name: trimmed })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function recordMenuPreview(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ has_previewed_menu: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function recordQrPrint(): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('restaurants')
    .update({ has_printed_qr: true })
    .eq('id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
