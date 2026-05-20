import Link from 'next/link'
import { ThemeSwitcher } from '@/components/theme-switcher'

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 w-full border-b border-border bg-surface-base/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="text-headline font-semibold text-text-primary">
          dine-in-cc
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-footnote font-medium text-text-primary transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-footnote font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            Get started
          </Link>
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  )
}
