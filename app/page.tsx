import { LandingNav } from '@/components/marketing/LandingNav'
import { LandingHero } from '@/components/marketing/LandingHero'
import { LandingFeatures } from '@/components/marketing/LandingFeatures'
import { LandingHowItWorks } from '@/components/marketing/LandingHowItWorks'
import { LandingPricing } from '@/components/marketing/LandingPricing'
import { LandingFooter } from '@/components/marketing/LandingFooter'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-surface-base">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingFooter />
    </main>
  )
}
