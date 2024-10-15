import { ReporterDescription, defineConfig } from '@playwright/test';

const reporters: ReporterDescription[] = [['list'], ['html', { open: 'never' }]];
if (process.env.CI) {
  reporters.push(['github']);
}

export default defineConfig({
  testMatch: 'spec.ts',
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  retries: process.env.CI ? 3 : 0,
  workers: 5,
  reporter: reporters,
  webServer: {
    command: 'npm run build && npm run preview',
    port: 3007,
    timeout: 120 * 1000
  }
});
