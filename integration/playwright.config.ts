import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
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
