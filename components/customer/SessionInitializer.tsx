'use client'

import { useEffect } from 'react'
import { initAnonymousSession } from '@/actions/customerActions'

interface Props {
  restaurantId: string
  tableNumber: number
}

export function SessionInitializer({ restaurantId, tableNumber }: Props) {
  useEffect(() => {
    initAnonymousSession(restaurantId, tableNumber)
  }, [restaurantId, tableNumber])

  return null
}
