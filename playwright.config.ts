import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * The suite runs against the production build by default, because that is where
 * the parts most worth testing actually live: the service worker, the injected
 * CSP, and the code-split chunks. `E2E_DEV=1` switches to the dev server when
 * iterating on a test.
 */
const useDevServer = process.env.E2E_DEV === '1'
const PORT = Number(process.env.E2E_PORT ?? 4173)
const baseURL = `http://localhost:${PORT}/`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',

  // Every spec starts from an empty origin, so tests never inherit each other's
  // IndexedDB. That rules out parallel workers sharing one browser context but
  // costs little: the whole suite is a couple of minutes.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Encryption and vault export both run PBKDF2 at 310,000 iterations, which
    // is deliberately slow; the default 5s action timeout is not enough.
    actionTimeout: 15_000,
    // Lets a machine with a preinstalled Chromium of another revision run the
    // suite without downloading browsers (PW_CHROMIUM_PATH=/path/to/chrome).
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },

  projects: [
    {
      name: 'chromium',
      // The narrow-layout spec only makes sense on a phone viewport.
      testIgnore: '**/responsive.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 820 } },
    },
    {
      name: 'mobile',
      testMatch: '**/responsive.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    command: useDevServer
      ? `pnpm vite --port ${PORT} --strictPort`
      : `pnpm vite build && pnpm vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
