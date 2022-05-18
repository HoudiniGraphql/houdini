import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run generate && npm run build && npm run start',
		port: 3000,
	},
}

export default config
