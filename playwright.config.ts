import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  // ✅ All artifacts go here
  outputDir: 'playwright-report/',

  // ✅ Use HTML reporter instead of line (or combine both)
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report/', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',

    // ✅ Ensure artifacts are actually created
    screenshot: 'only-on-failure',   // or 'on'
    video: 'retain-on-failure',
    trace: 'retain-on-failure',     // better than on-first-retry if retries=0
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});