import Link from 'next/link'
import { Check } from 'lucide-react'

const INCLUDED = [
  'Unlimited menu items and variants',
  'Unlimited tables and QR codes',
  'Real-time order delivery',
  'Email support during onboarding',
]

export function LandingPricing() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 lg:py-24">
      <h2 className="text-title-2 text-text-primary text-center">
        Simple, flat monthly pricing
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-callout text-text-secondary text-center">
        One price per restaurant. No per-seat fees, no per-order fees, no
        feature gating. We&rsquo;re currently onboarding our first restaurants —
        contact us for early-access rates.
      </p>
      <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-surface-raised p-8">
        <p className="text-headline text-text-primary">Single tier</p>
        <p className="mt-1 text-subhead text-text-secondary">
          Everything in one plan.
        </p>
        <ul className="mt-6 space-y-3">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check className="mt-0.5 flex-shrink-0 text-success" size={18} aria-hidden />
              <span className="text-subhead text-text-primary">{item}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/auth/sign-up"
          className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-accent px-6 py-3 text-headline font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          Start free
        </Link>
      </div>
    </section>
  )
}
