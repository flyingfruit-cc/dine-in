import { CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

interface OnboardingChecklistProps {
  hasMenuItems: boolean
  hasPreviewedMenu: boolean
  isPublished: boolean
  hasTables: boolean
  hasPrintedQr: boolean
}

interface Step {
  label: string
  complete: boolean
  href: string
  cta: string
}

export function OnboardingChecklist({
  hasMenuItems,
  hasPreviewedMenu,
  isPublished,
  hasTables,
  hasPrintedQr,
}: OnboardingChecklistProps) {
  const steps: Step[] = [
    {
      label: 'Add menu items',
      complete: hasMenuItems,
      href: '/admin/menu',
      cta: 'Add items →',
    },
    {
      label: 'Preview menu',
      complete: hasPreviewedMenu,
      href: '/admin/menu/preview',
      cta: 'Preview →',
    },
    {
      label: 'Publish menu',
      complete: isPublished,
      href: '/admin/menu',
      cta: 'Publish →',
    },
    {
      label: 'Create tables',
      complete: hasTables,
      href: '/admin/tables',
      cta: 'Create tables →',
    },
    {
      label: 'Print QR codes',
      complete: hasPrintedQr,
      href: '/admin/tables',
      cta: 'Print QR codes →',
    },
  ]

  const completedCount = steps.filter((s) => s.complete).length
  const allComplete = completedCount === steps.length

  if (allComplete) return null

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          Get started
        </h2>
        <span className="text-sm text-text-secondary">
          {completedCount} of {steps.length} steps complete
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`flex items-center justify-between gap-4 ${step.complete ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              {step.complete ? (
                <CheckCircle2
                  size={20}
                  className="shrink-0 text-text-secondary"
                />
              ) : (
                <Circle size={20} className="shrink-0 text-accent" />
              )}
              <span
                className={`text-sm ${step.complete ? 'text-text-secondary line-through' : 'text-text-primary'}`}
              >
                {step.label}
              </span>
            </div>
            {!step.complete && (
              <Link
                href={step.href}
                className="shrink-0 text-sm text-accent hover:underline"
              >
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
