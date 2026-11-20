import { defineConfig, devices } from '@playwright/test';

// Tests run against a production build served under a project-pages subpath,
// exactly as GitHub Pages serves it (BASE_PATH=/ccdvp-test/).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4391/ccdvp-test/',
    trace: 'off',
  },
  webServer: {
    command:
      'BASE_PATH=/ccdvp-test/ pnpm astro build --outDir .ccdvp-e2e/dist && pnpm exec pagefind --site .ccdvp-e2e/dist && node tests/serve.mjs .ccdvp-e2e/dist 4391 /ccdvp-test/',
    url: 'http://localhost:4391/ccdvp-test/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
    },
  ],
});
