import { defineConfig, devices } from '@playwright/test';

/**
 * The suite runs against the developer's own stack by design — the servers on
 * :3000 and :4200 stay up permanently, so there is deliberately NO `webServer`
 * locally: Playwright must neither start nor stop them. `global-setup.ts`
 * preflights both and fails with a readable message if either is down.
 *
 * CI is the only place that boots its own stack, because there is nothing
 * running there to reuse.
 */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4200';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './src',
  outputDir: './test-output/playwright/results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: require.resolve('./src/global-setup'),
  globalTeardown: require.resolve('./src/global-teardown'),
  reporter: isCI
    ? [['blob', { outputDir: './test-output/playwright/blob' }], ['list']]
    : [
        [
          'html',
          { outputFolder: './test-output/playwright/report', open: 'never' },
        ],
        ['list'],
      ],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    /**
     * The gym's clock. Without this a machine on UTC renders dates one day
     * behind the server's gym day for three hours out of every 24 — see
     * apps/backend/src/common/gym-day.ts.
     */
    timezoneId: 'Africa/Addis_Ababa',
    locale: 'en-GB',
    // The app defaults to dark; pinning it keeps screenshots stable and stops
    // the result depending on the runner's prefers-color-scheme.
    colorScheme: 'dark',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'api',
      testDir: './src/api',
      dependencies: ['setup'],
      use: { baseURL: API_URL },
    },
    {
      name: 'ui',
      testDir: './src/ui',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    /**
     * Specs that need the database to hold still.
     *
     * The dashboard has no filters, so its tests can only assert deltas — and a
     * delta is meaningless while another worker is creating members. Depending
     * on api and ui makes this project run once both have finished, and
     * `fullyParallel: false` keeps its own tests one at a time.
     */
    {
      name: 'serial',
      testDir: './src/serial',
      dependencies: ['setup', 'api', 'ui'],
      fullyParallel: false,
      use: { baseURL: API_URL },
    },
  ],
  webServer: isCI
    ? [
        {
          command: 'npx nx run @org/backend:serve',
          cwd: '../..',
          url: `${API_URL}/api/health`,
          reuseExistingServer: false,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        {
          command: 'npx nx run @org/frontend:dev -- --port=4200 --strictPort',
          cwd: '../..',
          url: WEB_URL,
          reuseExistingServer: false,
          timeout: 180_000,
          env: { VITE_BASE_URL: API_URL },
        },
      ]
    : undefined,
});
