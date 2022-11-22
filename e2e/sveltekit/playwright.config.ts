// manual switch for now until replayio is fixed (currently breaking our tests)
const with_replayio = false;

const use = with_replayio
  ? {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...replayDevices['Replay Chromium'],
      screenshot: 'only-on-failure'
    }
  : { screenshot: 'only-on-failure' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reporter = [['list']];
if (process.env.CI) {
  reporter.push(['html', { open: 'never' }]);
  reporter.push(['github']);
}

const config = {
  retries: process.env.CI ? 3 : 0,
  workers: 5,
  reporter,
  use,
  webServer: {
    command: 'npm run build && npm run preview',
    port: 3007
  }
};

export default config;
