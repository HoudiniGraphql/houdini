import type { PlaywrightTestConfig } from '@playwright/test';
import { devices as replayDevices } from '@replayio/playwright';
import defaultConfig from './playwright.config.ts';

const config: PlaywrightTestConfig = {
  ...defaultConfig,
  use: { ...(replayDevices['Replay Chromium'] as any) }
};

export default config;
