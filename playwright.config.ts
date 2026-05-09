import { defineConfig } from "@playwright/test"

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
