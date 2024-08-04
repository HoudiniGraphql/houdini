import { defineConfig } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reporter = [['list']]
if (process.env.CI) {
	reporter.push(['html', { open: 'never' }])
	reporter.push(['github'])
}

const config = defineConfig({
	retries: process.env.CI ? 3 : 0,
  testMatch: 'spec.ts',
	workers: 5,
	reporter,
	screenshot: 'only-on-failure',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 3006,
		timeout: 120 * 1000,
	},
});

export default config
