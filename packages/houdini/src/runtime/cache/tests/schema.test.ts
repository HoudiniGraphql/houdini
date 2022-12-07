import { expect, test } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../cache'

const config = testConfigFile()

test('writing a selection loads the schema information', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// write the data
	cache.write({
		selection: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
					firstName: {
						type: 'String',
						keyRaw: 'firstName(id: "1")',
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// make sure we saved all of the type information
	expect(cache._internal_unstable.schema.fieldTypes).toEqual({
		Query: {
			viewer: {
				type: 'User',
				nullable: false,
			},
		},
		User: {
			id: {
				type: 'ID',
				nullable: false,
			},
			firstName: {
				type: 'String',
				nullable: false,
			},
		},
	})
})
