import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import { SubscriptionSelection } from '../../lib/types'
import { Cache, rootID } from '../cache'

const config = testConfigFile({
	scalars: {
		DateTime: {
			type: 'Date',
			marshal(val: Date) {
				return val.getTime()
			},
			unmarshal(val: number) {
				return new Date(val)
			},
		},
	},
})

test('extracting data with custom scalars unmarshals the value', () => {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// the selection we are gonna write
	const selection = {
		node: {
			type: 'Node',
			keyRaw: 'node',
			fields: {
				date: {
					type: 'DateTime',
					keyRaw: 'date',
				},
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
			},
		},
	}

	// save the data
	const data = {
		node: {
			id: '1',
			date: new Date().getTime(),
		},
	}

	// write the data to cache
	cache.write({ selection, data })

	// pull the data out of the cache
	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		node: {
			id: '1',
			date: new Date(data.node.date),
		},
	})
})

test('can store and retrieve lists of lists of scalars', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				strings: {
					type: 'String',
					keyRaw: 'strings',
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				strings: ['bob', 'john'],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: {
			id: '1',
			strings: ['bob', 'john'],
		},
	})
})

test('can write list of scalars', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection = {
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
					keyRaw: 'firstName',
				},
				friends: {
					type: 'Int',
					keyRaw: 'friends',
				},
			},
		},
	}

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [1],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1],
		},
	})
})

test('writing a scalar marked with replace', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection = {
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
					keyRaw: 'firstName',
				},
				friends: {
					type: 'Int',
					keyRaw: 'friends',
					update: 'append',
				},
			},
		},
	} as SubscriptionSelection

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [1],
			},
		},
	})

	// make sure we can get the linked lists back
	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [1],
		},
	})

	// add some data to the cache
	cache.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friends: [2],
			},
		},
	})

	// make sure we can get the updated lists back
	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
			friends: [2],
		},
	})
})
