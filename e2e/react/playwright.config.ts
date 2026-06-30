import { defineConfig } from '@playwright/test'

export default defineConfig({
	retries: process.env.CI ? 3 : 0,
	workers: 5,
	reporter: process.env.CI ? [['list'], ['html'], ['github']] : [['list']],
	// baseURL must be explicit now that webServer is an array (Playwright only auto-derives it from
	// a single server)
	use: { screenshot: 'only-on-failure', baseURL: 'http://localhost:3008' },
	testIgnore: '**/$houdini/**',
	testMatch: 'test.ts',

	webServer: [
		{
			command: 'NODE_ENV=production PORT=3008 node build/index.js',
			port: 3008,
			timeout: 120 * 1000,
			reuseExistingServer: !process.env.CI,
		},
		{
			// the third-party OIDC provider mock the first-class OAuth e2e drives against
			command: 'node oauth-mock.mjs',
			port: 8081,
			timeout: 120 * 1000,
			reuseExistingServer: !process.env.CI,
		},
	],
})
