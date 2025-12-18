import { defineConfig } from '@playwright/test';

const reporters = [['list'], ['html', { open: 'never' }]];
if (process.env.CI) {
  reporters.push(['github']);
}

export default defineConfig({
  testMatch: 'spec.ts',
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
    // Increase timeouts for CI environments
    actionTimeout: process.env.CI ? 30000 : 10000,
    navigationTimeout: process.env.CI ? 30000 : 10000,
  },
  // Global test timeout
  timeout: process.env.CI ? 60000 : 30000,
  // Expect timeout for assertions
  expect: {
    timeout: process.env.CI ? 10000 : 5000,
  },
  retries: process.env.CI ? 3 : 0,
  workers: 5,
  reporter: reporters,
  webServer: {
    command: 'npm run build && npm run preview-e2e',
    port: 3007,
    timeout: 120 * 1000
  }
});
