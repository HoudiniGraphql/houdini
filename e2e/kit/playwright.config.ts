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
    timezoneId: 'UTC'
  },
  retries: process.env.CI ? 3 : 0,
  workers: 5,
  reporter: reporters,
  webServer: {
    command: 'npm run preview',
    port: 4173,
    timeout: 120 * 1000
  }
});
