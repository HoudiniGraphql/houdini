import type { PlaywrightTestConfig } from '@playwright/test';
import { devices as replayDevices } from '@replayio/playwright';

const config: PlaywrightTestConfig = {
  retries: 5,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list']],
  use: {
    screenshot: 'only-on-failure',
    ...(replayDevices['Replay Chromium'] as any)
  },
  webServer: {
    command: 'npm run generate && npm run build && npm run preview',
    port: 3007
  }
};

export default config;
