import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * Regenerates the README / store screenshots in every language.
 *
 * Kept apart from the test suite on purpose: `pnpm test:e2e` never runs it, and
 * it writes into `docs/screenshots/<locale>/` instead of `test-results/`.
 *
 *   pnpm screenshots            every language
 *   pnpm screenshots --grep es  just one
 */
export default defineConfig({
  ...base,
  testDir: './e2e/screenshots',
  testMatch: '**/*.shot.ts',
  retries: 0,
  // Many browsers booting the app at once can starve the preview server.
  workers: 4,
  reporter: [['list']],
  projects: [
    {
      name: 'screenshots',
      use: {
        ...base.use,
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
        // Sparklines draw themselves in; reduced motion shows them finished.
        reducedMotion: 'reduce',
        timezoneId: 'UTC',
        screenshot: 'off',
        trace: 'off',
      },
    },
  ],
})
