import { ThemeSwitcher } from '@/components/theme-switcher'

export function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="w-full border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-footnote text-text-tertiary">
          Are you a diner? Scan the QR code on your table.
        </p>
        <div className="flex items-center gap-4">
          <p className="text-footnote text-text-tertiary">
            &copy; {year} dine-in-cc
          </p>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  )
}
