import { Utensils, QrCode, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: Utensils,
    title: 'Drag-and-drop menu builder',
    body: 'Categories, variants, photos, and availability windows. Update anytime — changes go live the moment you publish.',
  },
  {
    icon: QrCode,
    title: 'A QR code per table',
    body: 'Generate, download, and print unique codes for every table. Guests scan, browse, and order — no app install.',
  },
  {
    icon: Zap,
    title: 'Orders in real time',
    body: 'New tickets appear on your Admin UI within seconds. Tap to mark handled. Polling fallback if the network blinks.',
  },
] as const

export function LandingFeatures() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 lg:py-24">
      <h2 className="text-title-2 text-text-primary text-center">
        Everything you need to take orders at the table
      </h2>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-surface-raised p-6"
          >
            <Icon className="text-accent" size={28} aria-hidden />
            <h3 className="mt-4 text-headline text-text-primary">{title}</h3>
            <p className="mt-2 text-subhead text-text-secondary">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
