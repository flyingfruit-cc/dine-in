'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Category } from '@/types/app'

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
