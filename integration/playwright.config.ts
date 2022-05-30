import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run generate && npm run build && npm run preview',
    port: 3000
  }
};

export default config;
