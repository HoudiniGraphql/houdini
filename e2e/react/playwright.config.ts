import { defineConfig } from '@playwright/test'

export default defineConfig({
	retries: process.env.CI ? 3 : 0,
	workers: 5,
	reporter: process.env.CI ? [['list'], ['html'], ['github']] : [['list']],
	use: { screenshot: 'only-on-failure' },
	testIgnore: '**/$houdini/**',

	webServer: {
		command: 'npm run build && npm run preview',
		port: 3008,
		timeout: 120 * 1000,
	},
})
