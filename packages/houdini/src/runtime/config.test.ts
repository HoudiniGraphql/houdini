import { test, expect, describe, beforeEach } from 'vitest'

import type { ConfigFile } from '../lib/types'
import {
	entityRefetchVariables,
	getAuthUrl,
	setAuthUrl,
	getApiEndpoint,
	setApiEndpoint,
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

// the session endpoint and GraphQL endpoint are server-only config injected to the client at
// render (window.__houdini__auth_url__ / __houdini__api_endpoint__). The server sets them from the
// ServerConfigFile at init, the client from the injected globals at hydration; both go through
// these module-level setters so the relay/query layer can read the resolved value without the
// urls ever living in the client config bundle.
describe('injected endpoints (getAuthUrl / getApiEndpoint)', () => {
	beforeEach(() => {
		setAuthUrl(undefined)
		setApiEndpoint(undefined)
	})

	test('fall back to their defaults until set', () => {
		expect(getAuthUrl()).toBe(DEFAULT_AUTH_URL)
		expect(getApiEndpoint()).toBe(DEFAULT_API_ENDPOINT)
	})

	test('publish a configured endpoint once set', () => {
		setAuthUrl('/auth/token')
		setApiEndpoint('/_graphql')
		expect(getAuthUrl()).toBe('/auth/token')
		expect(getApiEndpoint()).toBe('/_graphql')
	})

	test('a blank/null value resets to the default rather than serving an empty endpoint', () => {
		setAuthUrl('/auth/token')
		setApiEndpoint('/_graphql')
		setAuthUrl(null)
		setApiEndpoint('')
		expect(getAuthUrl()).toBe(DEFAULT_AUTH_URL)
		expect(getApiEndpoint()).toBe(DEFAULT_API_ENDPOINT)
	})
})
