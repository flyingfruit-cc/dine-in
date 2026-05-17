'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/types/app'

export async function initAnonymousSession(
  restaurantId: string,
  tableNumber: number
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const appMeta = session?.user?.app_metadata as { restaurant_id?: string } | undefined

  const needsNewSession =
    !session ||
    session.user.is_anonymous !== true ||
    appMeta?.restaurant_id !== restaurantId

  if (!needsNewSession) return { success: true, data: undefined }

  const { data: { session: anonSession }, error: signInError } = await supabase.auth.signInAnonymously()
  if (signInError || !anonSession) {
    return { success: false, error: signInError?.message ?? 'Anonymous sign-in failed' }
  }

  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient.auth.admin.updateUserById(anonSession.user.id, {
    app_metadata: { restaurant_id: restaurantId, table_number: tableNumber },
  })
  if (updateError) {
    return { success: false, error: updateError.message }
  }

  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { success: false, error: refreshError.message }
  }

  return { success: true, data: undefined }
}
