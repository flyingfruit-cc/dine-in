'use client'

// Client-selection rules: see docs/conventions/supabase-clients.md
// This is a browser-side Realtime subscription, so it uses the browser client.

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrderStore } from '@/stores/orderStore'
import type { Order } from '@/types/app'

interface Props {
  restaurantId: string
  children: React.ReactNode
}

const POLLING_INTERVAL_MS = 4000

export function RealtimeProvider({ restaurantId, children }: Props) {
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function refetchOrders() {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        // Fetches ALL orders (handled + unhandled) so Handled/All tabs populate correctly.
        // Known limit: if >100 total orders in one shift, oldest handled may not appear.
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('submitted_at', { ascending: false })
          .limit(100)
        if (error) {
          console.error('[RealtimeProvider] refetchOrders error:', error.message)
          return
        }
        if (cancelled || !data) return
        useOrderStore.getState().setOrders(data as unknown as Order[])
      } finally {
        inFlightRef.current = false
      }
    }

    function startPolling() {
      if (pollingIntervalRef.current) return
      pollingIntervalRef.current = setInterval(refetchOrders, POLLING_INTERVAL_MS)
    }

    function stopPolling() {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    async function propagateAuthToRealtime() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token)
      }
    }

    async function init() {
      await propagateAuthToRealtime()
      if (cancelled) return

      await refetchOrders()
      if (cancelled) return

      channel = supabase
        .channel(`orders-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload: { new: Order }) => {
            useOrderStore.getState().addOrder(payload.new)
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload: { new: Order }) => {
            useOrderStore.getState().updateOrder(payload.new)
          },
        )
        .subscribe(async (status: string) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            // Re-propagate auth in case the access token was refreshed during a disconnect;
            // Realtime won't pick it up on its own across reconnects.
            await propagateAuthToRealtime()
            if (cancelled) return
            useOrderStore.getState().setRealtimeReady(true)
            stopPolling()
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
            useOrderStore.getState().setRealtimeReady(false)
            startPolling()
          }
        })
    }

    // Keep the Realtime socket's JWT in lockstep with the user's session.
    // TOKEN_REFRESHED fires roughly every hour without this listener the
    // channel reports SUBSCRIBED but RLS silently drops every payload.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      } else if (event === 'SIGNED_OUT') {
        useOrderStore.getState().reset()
      }
    })

    init()

    return () => {
      cancelled = true
      stopPolling()
      authListener?.subscription?.unsubscribe?.()
      useOrderStore.getState().reset()
      if (channel) supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return <>{children}</>
}
