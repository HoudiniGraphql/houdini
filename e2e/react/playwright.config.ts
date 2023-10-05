const reporter = [['list']]
if (process.env.CI) {
	reporter.push(['html'])
	reporter.push(['github'])
}

const config = {
	retries: process.env.CI ? 3 : 0,
	workers: 5,
	reporter,
	use: { screenshot: 'only-on-failure' },
	webServer: {
		command: 'npm run build && npm run preview',
		port: 3008,
		timeout: 120 * 1000,
	},
}

export default config
