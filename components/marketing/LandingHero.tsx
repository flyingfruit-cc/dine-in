import Link from 'next/link'

export function LandingHero() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-20 text-center lg:py-32">
      <h1 className="text-title-1 text-text-primary lg:text-display">
        QR-code dine-in ordering
        <br />
        that just works.
      </h1>
      <p className="mt-6 max-w-xl text-callout text-text-secondary lg:text-body">
        Put a code on every table. Take orders the moment your guest is ready —
        no apps, no waiting, no missed tickets.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-headline font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          Get started — free
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-6 py-3 text-headline font-medium text-text-primary transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          Sign in
        </Link>
      </div>
    </section>
  )
}
