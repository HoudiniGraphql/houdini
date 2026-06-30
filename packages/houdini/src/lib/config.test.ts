import { test, expect, describe } from 'vitest'

import { testConfig } from '../test/index.js'

// api_url resolves the schema-introspection endpoint. With the top-level `url`, watchSchema.url is
// optional (defaults to `url`), and watchSchema can be set to false/null to disable introspection.
describe('Config.api_url', () => {
	test('falls back to the top-level url when watchSchema is omitted', async () => {
		const config = testConfig()
		;(config.config_file as any).url = 'http://api.test/graphql'
		delete config.config_file.watchSchema
		expect(await config.api_url()).toBe('http://api.test/graphql')
	})

	test('watchSchema.url wins over the top-level url', async () => {
		const config = testConfig()
		;(config.config_file as any).url = 'http://api.test/graphql'
		config.config_file.watchSchema = { url: 'http://introspect.test/graphql' }
		expect(await config.api_url()).toBe('http://introspect.test/graphql')
	})

	test('watchSchema: false disables introspection even when url is set', async () => {
		const config = testConfig()
		;(config.config_file as any).url = 'http://api.test/graphql'
		config.config_file.watchSchema = false
		expect(await config.api_url()).toBe('')
	})

	test('watchSchema: null disables introspection even when url is set', async () => {
		const config = testConfig()
		;(config.config_file as any).url = 'http://api.test/graphql'
		config.config_file.watchSchema = null
		expect(await config.api_url()).toBe('')
	})
})
