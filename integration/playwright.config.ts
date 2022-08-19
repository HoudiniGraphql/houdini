import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // retries: 5,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list']],
  use: {
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 3007
  }
};

export default config;
