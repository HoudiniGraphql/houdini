import type { PlaywrightTestConfig } from '@playwright/test';
import { devices as replayDevices } from '@replayio/playwright';
import defaultConfig from './playwright.config';

const config: PlaywrightTestConfig = {
  ...defaultConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: { ...(replayDevices['Replay Chromium'] as any) }
};

export default config;
