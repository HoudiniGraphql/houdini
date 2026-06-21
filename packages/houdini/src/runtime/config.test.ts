import { test, expect, describe } from 'vitest'

import type { ConfigFile } from '../lib/types'
import { entityRefetchVariables } from './config.js'

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
