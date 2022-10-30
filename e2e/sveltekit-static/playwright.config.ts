const use = { screenshot: 'only-on-failure' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reporter = [['list']];
if (process.env.CI) {
	reporter.push(['html', { open: 'never' }]);
	reporter.push(['github']);
}

const config = {
	// retries: 2,
	workers: 5,
	reporter,
	use,
	webServer: {
		command: 'npm run build && npm run preview',
		port: 3008
	}
};

export default config;
