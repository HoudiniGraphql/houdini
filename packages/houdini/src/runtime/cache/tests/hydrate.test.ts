import { expect, test } from 'vitest'

import { testConfigFile } from '../../../test/index.js'
import type { SubscriptionSelection } from '../../types.js'
import { Cache } from '../index.js'

const config = testConfigFile()

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
				},
			},
		},
	},
}

// hydrated fields must participate in staleness like written fields: field times are
// normally recorded on write, and a field without one reads as "not stale" forever — so
// without registration at hydrate time, hydrated data could never be invalidated (e.g.
// by a session change marking everything stale).
test('hydrated data can be marked stale', () => {
	// write into one cache and serialize (the SSR side)
	const server = new Cache(config)
	server.write({
		selection,
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})
	const snapshot = JSON.parse(server.serialize())

	// hydrate a fresh cache from the snapshot (the browser side)
	const browser = new Cache(config)
	browser.hydrate(snapshot)

	// the data reads back fresh
	const before = browser.read({ selection })
	expect(before.data).toEqual({ viewer: { id: '1', firstName: 'bob' } })
	expect(before.stale).toBe(false)

	// marking everything stale must reach the hydrated fields
	browser.markTypeStale()
	expect(browser.read({ selection }).stale).toBe(true)
})
