import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import type { SubscriptionSelection } from '../../lib/types'
import { Cache, rootID } from '../cache'

const config = testConfigFile()

test('client-side nullability', function () {
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				nullable: true,
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						name: {
							type: 'string',
							visible: true,
							keyRaw: 'name',
						},
						birthDate: {
							type: 'DateTime',
							visible: true,
							keyRaw: 'birthDate',
						},
					},
				},
			},
		},
	}

	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				name: 'bob',
				birthDate: new Date('1980-01-01T00:00:00.000Z').getTime(),
			},
		},
	})

	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: {
			id: '1',
			name: 'bob',
			birthDate: new Date('1980-01-01T00:00:00.000Z'),
		},
	})

	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				name: 'bob',
				birthDate: null,
			},
		},
	})

	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: null,
	})
})
