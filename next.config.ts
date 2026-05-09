import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

initOpenNextCloudflareForDev()

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, { silent: true })
