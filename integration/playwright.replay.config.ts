import type { PlaywrightTestConfig } from '@playwright/test';
import { devices as replayDevices } from '@replayio/playwright';

const config: PlaywrightTestConfig = {
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list']],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: { ...(replayDevices['Replay Chromium'] as any) },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 3007
  }
};

export default config;
