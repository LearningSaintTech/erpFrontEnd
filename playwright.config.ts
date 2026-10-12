import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end user-flow suites. Run against a LOCAL stack with an in-memory backend:
 *   PLAYWRIGHT_BASE_URL=http://localhost:5310 E2E_API_URL=http://localhost:3310/api/v1 npx playwright test
 * Each spec file is one business flow driven role-by-role, so tests inside a file run in order.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5310';

// Visual baselines are OS-specific (generated on Windows) and the perf spec needs the large
// seed (SEED_LARGE=true backend) — CI on Linux opts out of both.
const testIgnore = [
  ...(process.env.E2E_SKIP_VISUAL === 'true' ? ['**/visual.spec.ts'] : []),
  ...(process.env.E2E_SKIP_PERF === 'true' ? ['**/perf.spec.ts'] : []),
];

export default defineConfig({
  testDir: './e2e',
  testIgnore,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
