import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import type { SubscriptionSelection } from '../../lib/types'
import { RefetchUpdateMode } from '../../lib/types'
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
	const selection: SubscriptionSelection = {
		fields: {
			node: {
				type: 'Node',

				visible: true,
				keyRaw: 'node',
				selection: {
					fields: {
						date: {
							type: 'DateTime',

							visible: true,
							keyRaw: 'date',
						},
						id: {
							type: 'ID',

							visible: true,
							keyRaw: 'id',
						},
					},
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

test('reading a list of custom scalars unmarshals every scalar correctly', function () {
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			node: {
				type: 'Node',

				visible: true,
				keyRaw: 'node',
				selection: {
					fields: {
						dates: {
							type: 'DateTime',

							visible: true,
							keyRaw: 'dates',
						},
						id: {
							type: 'ID',

							visible: true,
							keyRaw: 'id',
						},
					},
				},
			},
		},
	}

	const data = {
		node: {
			id: '1',
			dates: [
				new Date(1955, 2, 19).getTime(),
				new Date(1948, 11, 21).getTime(),
				new Date(1937, 5, 0).getTime(),
			],
		},
	}

	cache.write({ selection, data })

	expect(cache.read({ parent: rootID, selection }).data).toEqual({
		node: {
			id: '1',
			dates: data.node.dates.map((d) => new Date(d)),
		},
	})
})

test('can store and retrieve lists of lists of scalars', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',

				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',

							visible: true,
							keyRaw: 'id',
						},
						strings: {
							type: 'String',

							visible: true,
							keyRaw: 'strings',
						},
					},
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

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',

				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',

							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',

							visible: true,
							keyRaw: 'firstName',
						},
						friends: {
							type: 'Int',

							visible: true,
							keyRaw: 'friends',
						},
					},
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

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',

				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
						},
						friends: {
							type: 'Int',
							keyRaw: 'friends',
							visible: true,
							updates: [RefetchUpdateMode.append],
						},
					},
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
