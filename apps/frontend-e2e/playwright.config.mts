import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 *
 * These drive the real stack: the SPA on 4200 against the API on 3000, on the
 * development database. `src/global-setup.ts` refuses to start if either is
 * missing, and `src/global-teardown.ts` removes every row the run created — in
 * SQL, because branches and plans have no delete endpoint and their names are
 * unique, so an API-only cleanup would silt up the pickers permanently.
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  globalSetup: './src/global-setup.ts',
  globalTeardown: './src/global-teardown.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  /**
   * The Nx preset leaves this to Playwright's default of one worker per core,
   * which pointed seven headless Chromium instances at a single Vite dev server
   * and knocked it over mid-run. Four is what this suite was tuned against.
   */
  workers: process.env.CI ? 2 : 4,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /**
     * The gym's clock. On a machine running UTC the browser would render dates
     * a day behind the server's gym day for three hours out of every 24, which
     * turns every "checked in today" assertion into a coin toss overnight.
     */
    timezoneId: 'Africa/Addis_Ababa',
    /** The app defaults to dark; pinning it keeps what the tests see stable. */
    colorScheme: 'dark',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx run @org/frontend:serve',
    url: 'http://localhost:4200',
    // Attaches to the dev server you already have running; only starts one when
    // nothing is listening, and then owns it for the run.
    reuseExistingServer: true,
    cwd: workspaceRoot,
    // Nx resolution plus a cold Vite start comfortably exceeds the 60s default.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    /**
     * Creates the staff personas and writes one storageState per persona, so
     * the specs start already signed in as the right person rather than driving
     * the login form several hundred times. Everything else depends on it.
     */
    {
      name: 'setup',
      testMatch: /personas\.setup\.ts$/,
    },
    /**
     * Chromium only: it is the sole browser downloaded into
     * ~/.cache/ms-playwright here, and naming one that is not installed is a
     * hard failure rather than a skip. Add firefox/webkit here and run
     * `npx playwright install firefox webkit` if that changes.
     */
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /personas\.setup\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
  ],
});
