'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/app'
import { ALLOWED_LANGUAGES, isAllowedLanguage } from '@/utils/languages'

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

export async function updateRestaurantLanguages(
  supported_languages: string[],
  default_language: string,
): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!restaurantId) return { success: false, error: 'No restaurant found', code: 'NOT_FOUND' }

  if (!Array.isArray(supported_languages) || !supported_languages.every(isAllowedLanguage)) {
    return { success: false, error: 'Invalid language selection', code: 'INVALID_LANGUAGE' }
  }
  const uniqueLanguages = Array.from(new Set(supported_languages))
  if (uniqueLanguages.length < 1 || uniqueLanguages.length > ALLOWED_LANGUAGES.length) {
    return { success: false, error: 'Invalid language selection', code: 'INVALID_LANGUAGE' }
  }
  if (!uniqueLanguages.includes('en')) {
    return { success: false, error: 'English is required', code: 'INVALID_LANGUAGE' }
  }
  if (!uniqueLanguages.includes(default_language)) {
    return { success: false, error: 'Default language must be one of the enabled languages', code: 'INVALID_LANGUAGE' }
  }

  const { error } = await supabase
    .from('restaurants')
    .update({ supported_languages: uniqueLanguages, default_language })
    .eq('id', restaurantId)

  if (error) {
    console.error('[updateRestaurantLanguages]', error)
    return { success: false, error: 'Save failed — tap to retry', code: 'UPDATE_FAILED' }
  }
  return { success: true, data: undefined }
}
