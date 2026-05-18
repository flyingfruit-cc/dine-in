export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const submittedAt = new Date(iso)
  const diffMs = now.getTime() - submittedAt.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'just now'
  if (diffMin <= 60) return `${diffMin}m ago`

  return submittedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
