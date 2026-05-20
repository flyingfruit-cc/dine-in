const STEPS = [
  {
    n: '1',
    title: 'Sign up your restaurant',
    body: 'Create an account, pick a URL slug, and confirm your email. Takes a minute.',
  },
  {
    n: '2',
    title: 'Build your menu',
    body: 'Add categories, items, variants, and prices. Preview exactly what guests will see, then publish.',
  },
  {
    n: '3',
    title: 'Print and place QR codes',
    body: 'Generate a code per table, download as PDF, and stick them on. Orders flow in as guests scan.',
  },
] as const

export function LandingHowItWorks() {
  return (
    <section className="w-full bg-surface-raised py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-5">
        <h2 className="text-title-2 text-text-primary text-center">
          From signup to live orders in under an hour
        </h2>
        <ol className="mt-12 grid gap-8 lg:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <li key={n} className="flex flex-col items-start">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-headline font-semibold text-white">
                {n}
              </span>
              <h3 className="mt-4 text-headline text-text-primary">{title}</h3>
              <p className="mt-2 text-subhead text-text-secondary">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
