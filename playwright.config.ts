import { defineConfig } from "@playwright/test"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load .env.local so RLS tests can access SUPABASE_* env vars
try {
  const raw = readFileSync(resolve(__dirname, ".env.local"), "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env.local absent in CI — env vars supplied via secrets */ }

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**", "**/*.unit.test.ts"],
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
})
