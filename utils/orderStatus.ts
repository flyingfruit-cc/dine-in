import type { OrderStatus } from '@/types/app'

export const STATUS_DOT_CLASS: Record<OrderStatus, string> = {
  received: 'bg-accent',
  preparing: 'bg-info',
  ready: 'bg-success',
  completed: 'bg-text-secondary opacity-40',
}

export const NEXT_STATUS_LABEL: Record<OrderStatus, string | null> = {
  received: 'Mark preparing',
  preparing: 'Mark ready',
  ready: 'Mark completed',
  completed: null,
}

export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
}
