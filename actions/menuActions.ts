'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, Category, MenuItem, MenuItemCreate, MenuItemUpdate, VariantGroup } from '@/types/app'

type TranslationPayload = { name: string; description?: string | null }

function toMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    ...row,
    variants: (row.variants ?? []) as VariantGroup[],
    translations: (row.translations ?? {}) as Record<string, { name: string; description?: string }>,
  } as MenuItem
}

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

export async function createCategory(
  name: string
): Promise<ActionResult<{ category: Category }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Category name is required' }

  // Use MAX+1 so gaps left by deletions don't collide with existing rows
  const { data: maxRow } = await supabase
    .from('categories')
    .select('display_order')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: trimmed, restaurant_id: restaurantId, display_order: nextOrder })
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create category' }
  return { success: true, data: { category: data as Category } }
}

export async function renameCategory(
  categoryId: string,
  name: string
): Promise<ActionResult<{ category: Category }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Category name is required' }

  const { data, error } = await supabase
    .from('categories')
    .update({ name: trimmed })
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to rename category' }
  return { success: true, data: { category: data as Category } }
}

export async function deleteCategory(
  categoryId: string
): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  // Delete items first — FK is ON DELETE SET NULL, not CASCADE
  const { error: itemsError } = await supabase
    .from('menu_items')
    .delete()
    .eq('category_id', categoryId)
    .eq('restaurant_id', restaurantId)

  if (itemsError) return { success: false, error: itemsError.message }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function createMenuItem(
  data: MenuItemCreate
): Promise<ActionResult<{ item: MenuItem }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const query = data.category_id
    ? supabase.from('menu_items').select('display_order').eq('restaurant_id', restaurantId).eq('category_id', data.category_id).order('display_order', { ascending: false }).limit(1).maybeSingle()
    : supabase.from('menu_items').select('display_order').eq('restaurant_id', restaurantId).is('category_id', null).order('display_order', { ascending: false }).limit(1).maybeSingle()

  const { data: maxRow, error: maxError } = await query
  if (maxError) return { success: false, error: maxError.message }
  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const { data: row, error } = await supabase
    .from('menu_items')
    .insert({ ...data, restaurant_id: restaurantId, display_order: nextOrder })
    .select()
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Failed to create item' }
  return { success: true, data: { item: toMenuItem(row) } }
}

export async function updateMenuItem(
  itemId: string,
  data: MenuItemUpdate
): Promise<ActionResult<{ item: MenuItem }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { data: row, error } = await supabase
    .from('menu_items')
    .update(data)
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Failed to update item' }
  return { success: true, data: { item: toMenuItem(row) } }
}

export async function deleteMenuItem(
  itemId: string
): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

export async function uploadMenuItemImage(
  itemId: string,
  formData: FormData
): Promise<ActionResult<{ imageUrl: string }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided' }

  if (!file.type.startsWith('image/')) return { success: false, error: 'File must be an image' }

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_IMAGE_BYTES) return { success: false, error: 'File must be under 5 MB' }

  const buffer = await file.arrayBuffer()
  const storagePath = `${restaurantId}/${itemId}/image`

  const adminClient = createAdminClient()
  const { error: uploadError } = await adminClient.storage
    .from('menu-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { success: false, error: uploadError.message }

  const { data: { publicUrl } } = adminClient.storage
    .from('menu-images')
    .getPublicUrl(storagePath)

  // Append a cache-buster so the browser fetches the new image after a replacement.
  // The storage path is fixed per item, so the CDN URL never changes on its own.
  const imageUrl = `${publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('menu_items')
    .update({ image_url: imageUrl })
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)

  if (updateError) return { success: false, error: updateError.message }

  return { success: true, data: { imageUrl } }
}

export async function reorderMenuItems(
  updates: { id: string; display_order: number }[]
): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const results = await Promise.all(
    updates.map(({ id, display_order }) =>
      supabase
        .from('menu_items')
        .update({ display_order })
        .eq('id', id)
        .eq('restaurant_id', restaurantId)
    )
  )

  const firstError = results.find((r) => r.error)?.error
  if (firstError) return { success: false, error: firstError.message }
  return { success: true, data: undefined }
}

export async function updateMenuItemTranslation(
  itemId: string,
  langCode: string,
  payload: TranslationPayload,
): Promise<ActionResult<{ item: MenuItem }>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!restaurantId) return { success: false, error: 'No restaurant found', code: 'NOT_FOUND' }

  const trimmedName = payload.name.trim()
  if (!trimmedName) {
    return { success: false, error: 'Translation name cannot be empty', code: 'INVALID_NAME' }
  }

  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select('supported_languages')
    .eq('id', restaurantId)
    .single()
  if (restError || !restaurant) {
    return { success: false, error: 'Restaurant not found', code: 'NOT_FOUND' }
  }
  if (!(restaurant.supported_languages as string[]).includes(langCode)) {
    return { success: false, error: 'Language not enabled for this restaurant', code: 'INVALID_LANGUAGE' }
  }

  const jsonbPayload: { name: string; description?: string } = { name: trimmedName }
  const desc = payload.description?.trim()
  if (desc) jsonbPayload.description = desc

  const { data: rows, error } = await supabase.rpc('update_menu_item_translation', {
    item_id: itemId,
    lang_code: langCode,
    payload: jsonbPayload,
  })
  if (error) {
    console.error('[updateMenuItemTranslation]', error)
    return { success: false, error: 'Save failed — tap to retry', code: 'UPDATE_FAILED' }
  }
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) return { success: false, error: 'Item not found', code: 'NOT_FOUND' }
  return { success: true, data: { item: toMenuItem(row as Record<string, unknown>) } }
}
