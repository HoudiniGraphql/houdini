import { test, expect, vi } from 'vitest'

import { testConfigFile } from '../../../test/index.js'
import { ArtifactKind } from '../../types.js'
import type { SubscriptionSelection } from '../../types.js'
import { Cache } from '../index.js'
import { rootID } from '../stuff.js'

const config = testConfigFile()

// a selection where every field of the user is visible to the document
const visibleSelection: SubscriptionSelection = {
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
				},
			},
		},
	},
}

// a selection that mirrors a query holding a fragment spread: the viewer field
// is visible but everything on the user (including its keys) is masked
const maskedSelection: SubscriptionSelection = {
	fields: {
		viewer: {
			type: 'User',
			visible: true,
			keyRaw: 'viewer',
			selection: {
				fields: {
					id: {
						type: 'ID',
						keyRaw: 'id',
					},
					firstName: {
						type: 'String',
						keyRaw: 'firstName',
					},
					friend: {
						type: 'User',
						keyRaw: 'friend',
						selection: {
							fields: {
								id: {
									type: 'ID',
									keyRaw: 'id',
								},
								firstName: {
									type: 'String',
									keyRaw: 'firstName',
								},
							},
						},
					},
				},
			},
		},
	},
}

test('refresh notifies documents subscribed to the record', () => {
	const cache = new Cache(config)

	cache.write({
		selection: visibleSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: visibleSelection,
		onMessage: set,
	})

	cache.refresh('User:1')

	// the document subscribes to multiple fields of the user but only gets one message
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })

	// refreshing the root sends the message too (the document subscribes to viewer)
	set.mockClear()
	cache.refresh(rootID)
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })
})

test('refresh never asks a subscription document to refetch', () => {
	const cache = new Cache(config)

	cache.write({
		selection: visibleSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})

	// a query and a subscription both contain the record
	const querySet = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: visibleSelection,
		onMessage: querySet,
	})

	const subscriptionSet = vi.fn()
	cache.subscribe({
		rootType: 'Subscription',
		kind: ArtifactKind.Subscription,
		selection: visibleSelection,
		onMessage: subscriptionSet,
	})

	cache.refresh('User:1')

	// the query refetches but the subscription is left alone — a live stream is
	// pushed from the server, never pulled
	expect(querySet).toHaveBeenCalledWith({ kind: 'refetch' })
	expect(subscriptionSet).not.toHaveBeenCalled()
})

test('refresh reaches documents that only contain the record behind a mask', () => {
	const cache = new Cache(config)

	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: maskedSelection,
		onMessage: set,
	})

	// writing to a masked field must not notify the document
	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane-prime',
				},
			},
		},
	})
	expect(set).not.toHaveBeenCalled()

	// but refreshing the masked records still finds the document
	cache.refresh('User:1')
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })

	set.mockClear()
	cache.refresh('User:2')
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })
})

test('refresh notifies every document that contains the record', () => {
	const cache = new Cache(config)

	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	// a query that contains the user behind a mask
	const querySet = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: maskedSelection,
		onMessage: querySet,
	})

	// a fragment mounted directly on the user
	const fragmentSet = vi.fn()
	cache.subscribe({
		rootType: 'User',
		parentID: 'User:1',
		selection: {
			fields: {
				firstName: {
					type: 'String',
					visible: true,
					keyRaw: 'firstName',
				},
			},
		},
		onMessage: fragmentSet,
	})

	cache.refresh('User:1')

	expect(querySet).toHaveBeenCalledTimes(1)
	expect(querySet).toHaveBeenCalledWith({ kind: 'refetch' })
	expect(fragmentSet).toHaveBeenCalledTimes(1)
	expect(fragmentSet).toHaveBeenCalledWith({ kind: 'refetch' })
})

test('link changes keep masked containment up to date', () => {
	const cache = new Cache(config)

	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: maskedSelection,
		onMessage: set,
	})

	// swap the masked friend link to a new record
	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '3',
					firstName: 'mark',
				},
			},
		},
	})
	// the link lives behind the mask so the document was not notified
	expect(set).not.toHaveBeenCalled()

	// the new friend is part of the document's data now
	cache.refresh('User:3')
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })

	// and the old one isn't anymore
	set.mockClear()
	cache.refresh('User:2')
	expect(set).not.toHaveBeenCalled()
})

test('list membership keeps masked containment up to date', () => {
	const cache = new Cache(config)

	const listSelection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: {
							type: 'ID',
							keyRaw: 'id',
						},
						friends: {
							type: 'User',
							keyRaw: 'friends',
							selection: {
								fields: {
									id: {
										type: 'ID',
										keyRaw: 'id',
									},
									firstName: {
										type: 'String',
										keyRaw: 'firstName',
									},
								},
							},
						},
					},
				},
			},
		},
	}

	cache.write({
		selection: listSelection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{ id: '2', firstName: 'jane' },
					{ id: '3', firstName: 'mark' },
				],
			},
		},
	})

	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: listSelection,
		onMessage: set,
	})

	// replace the masked list contents
	cache.write({
		selection: listSelection,
		data: {
			viewer: {
				id: '1',
				friends: [
					{ id: '3', firstName: 'mark' },
					{ id: '4', firstName: 'sally' },
				],
			},
		},
	})
	expect(set).not.toHaveBeenCalled()

	// the new member is contained, the removed one isn't
	cache.refresh('User:4')
	expect(set).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({ kind: 'refetch' })

	set.mockClear()
	cache.refresh('User:2')
	expect(set).not.toHaveBeenCalled()
})

test('unsubscribing removes masked containment', () => {
	const cache = new Cache(config)

	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	const set = vi.fn()
	const spec = {
		rootType: 'Query',
		selection: maskedSelection,
		onMessage: set,
	}
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	cache.refresh('User:1')
	cache.refresh('User:2')
	expect(set).not.toHaveBeenCalled()
})

test('deleting a record removes its containment', () => {
	const cache = new Cache(config)

	cache.write({
		selection: maskedSelection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				friend: {
					id: '2',
					firstName: 'jane',
				},
			},
		},
	})

	const set = vi.fn()
	cache.subscribe({
		rootType: 'Query',
		selection: maskedSelection,
		onMessage: set,
	})

	cache.delete('User:2')
	set.mockClear()

	cache.refresh('User:2')
	expect(set).not.toHaveBeenCalled()
})

test('refresh on an unknown record is a no-op', () => {
	const cache = new Cache(config)

	// nothing to assert beyond it not throwing
	cache.refresh('User:999')
})

test('refresh notifies a document exactly once even when subscribed to many fields', () => {
	// regression for the O(n²) dedup: the handler must fire once regardless of how
	// many fields of the record the document is subscribed to
	const cache = new Cache(config)

	const wideSelection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
						firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
						lastName: { type: 'String', visible: true, keyRaw: 'lastName' },
						email: { type: 'String', visible: true, keyRaw: 'email' },
					},
				},
			},
		},
	}

	cache.write({
		selection: wideSelection,
		data: { viewer: { id: '1', firstName: 'bob', lastName: 'smith', email: 'b@b.com' } },
	})

	const onMessage = vi.fn()
	cache.subscribe({ rootType: 'Query', selection: wideSelection, onMessage })

	cache.refresh('User:1')

	// subscribed to 4 fields on the record — must still only get one message
	expect(onMessage).toHaveBeenCalledTimes(1)
	expect(onMessage).toHaveBeenCalledWith({ kind: 'refetch' })
})

test('refresh after unsubscribe does not notify removed handler', () => {
	const cache = new Cache(config)

	cache.write({
		selection: visibleSelection,
		data: { viewer: { id: '1', firstName: 'bob' } },
	})

	const onMessage = vi.fn()
	const spec = { rootType: 'Query', selection: visibleSelection, onMessage }
	cache.subscribe(spec)
	cache.unsubscribe(spec)

	cache.refresh('User:1')
	expect(onMessage).not.toHaveBeenCalled()
})
