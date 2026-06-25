import { test, expect, describe, beforeEach } from 'vitest'

import type { ConfigFile } from '../lib/types'
import {
	entityRefetchVariables,
	getAuthUrl,
	setAuthUrl,
	resolveApiEndpoint,
	DEFAULT_AUTH_URL,
	DEFAULT_API_ENDPOINT,
} from './config.js'

describe('entityRefetchVariables', () => {
	test('Node uses the default id key', () => {
		const vars = entityRefetchVariables({} as ConfigFile, 'Node', { id: '42', name: 'Alec' })
		expect(vars).toEqual({ id: '42' })
	})

	test('falls back to the config default keys for an arbitrary type', () => {
		const vars = entityRefetchVariables({ defaultKeys: ['uuid'] } as ConfigFile, 'User', {
			uuid: 'abc',
			name: 'Alec',
		})
		expect(vars).toEqual({ uuid: 'abc' })
	})

	test('supports composite keys', () => {
		const config = {
			types: { Book: { keys: ['isbn', 'edition'] } },
		} as unknown as ConfigFile
		const vars = entityRefetchVariables(config, 'Book', {
			isbn: '123',
			edition: 2,
			title: 'GraphQL',
		})
		expect(vars).toEqual({ isbn: '123', edition: 2 })
	})

	test('uses a custom resolve.arguments function when configured', () => {
		const config = {
			types: {
				City: {
					resolve: {
						queryField: 'city',
						arguments: (city: any) => ({ name: city.name }),
					},
				},
			},
		} as unknown as ConfigFile
		const vars = entityRefetchVariables(config, 'City', { name: 'Paris', population: 2 })
		expect(vars).toEqual({ name: 'Paris' })
	})

	test('returns nothing for the Query type (no entity to look up)', () => {
		expect(entityRefetchVariables({} as ConfigFile, 'Query', { foo: 1 })).toEqual({})
	})

	test('returns nothing when there is no state', () => {
		expect(entityRefetchVariables({} as ConfigFile, 'Node', null)).toEqual({})
		expect(entityRefetchVariables({} as ConfigFile, undefined, { id: '1' })).toEqual({})
	})
})

// the session endpoint is server-only config injected to the client at render
// (window.__houdini__auth_url__): the server sets it from the ServerConfigFile at init, the client
// from the injected global at hydration, both through these module-level setters so the relay can
// read the resolved value without the url living in the client config bundle.
describe('injected session endpoint (getAuthUrl)', () => {
	beforeEach(() => {
		setAuthUrl(undefined)
	})

	test('falls back to the default until set', () => {
		expect(getAuthUrl()).toBe(DEFAULT_AUTH_URL)
	})

	test('publishes a configured endpoint once set', () => {
		setAuthUrl('/auth/token')
		expect(getAuthUrl()).toBe('/auth/token')
	})

	test('a blank/null value resets to the default rather than serving an empty endpoint', () => {
		setAuthUrl('/auth/token')
		setAuthUrl(null)
		expect(getAuthUrl()).toBe(DEFAULT_AUTH_URL)
	})
})

// the GraphQL endpoint is PUBLIC config the client reads straight from the bundle (no injection):
// the remote `url` when set, else the local mount `apiURL`, else the default.
describe('resolveApiEndpoint (from public config)', () => {
	test('prefers the remote url (remote API)', () => {
		expect(resolveApiEndpoint({ url: 'https://api.example.com/graphql' } as ConfigFile)).toBe(
			'https://api.example.com/graphql'
		)
	})

	test('falls back to the codegen-injected apiURL', () => {
		expect(resolveApiEndpoint({ apiURL: '/graphql' })).toBe('/graphql')
	})

	test('defaults when neither is set', () => {
		expect(resolveApiEndpoint({} as ConfigFile)).toBe(DEFAULT_API_ENDPOINT)
	})
})
