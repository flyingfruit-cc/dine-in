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

export async function createTable(number: number): Promise<ActionResult<{ id: string }>> {
  if (!Number.isInteger(number) || number < 1 || number > 999) {
    return { success: false, error: 'Table number must be an integer between 1 and 999' }
  }

  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { data, error } = await supabase
    .from('tables')
    .insert({ restaurant_id: restaurantId, number })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: `Table ${number} already exists` }
    return { success: false, error: error.message }
  }
  return { success: true, data: { id: data.id } }
}

export async function deleteTable(tableId: string): Promise<ActionResult<void>> {
  const { supabase, user, restaurantId } = await getAuthContext()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (!restaurantId) return { success: false, error: 'No restaurant found' }

  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', tableId)
    .eq('restaurant_id', restaurantId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}
