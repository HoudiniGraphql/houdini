import { test, describe, expect } from 'vitest'

import { readConfigFile } from './config'

describe('loadConfig', function () {
	test('handles malformed config file', async () => {
		const INVALID_CONFIG = '__mocks__/config.invalid.mock'

		await expect(async () => {
			await readConfigFile(INVALID_CONFIG)
		}).rejects.toThrowError(`Could not load config`)
	})
})
