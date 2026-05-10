import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'

export default function AdminPage() {
  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Dashboard
        </h1>
        <OnboardingChecklist
          hasMenuItems={false}
          hasPreviewedMenu={false}
          isPublished={false}
          hasTables={false}
          hasPrintedQr={false}
        />
      </div>
    </main>
  )
}
