import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    // Exclude Playwright RLS and E2E tests — those run via `npm run test:rls`
    exclude: ['tests/rls/**', 'tests/e2e/**', 'node_modules/**'],
  },
})
