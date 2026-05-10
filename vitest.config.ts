import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // Exclude Playwright RLS and E2E tests — those run via `npm run test:rls`
    exclude: ['tests/rls/**', 'tests/e2e/**', 'node_modules/**'],
  },
})
