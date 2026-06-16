import { Cache } from 'houdini/runtime/cache'
import { CachePolicy } from 'houdini/runtime/types'
import { beforeEach, expect, test, vi } from 'vitest'

import { testConfigFile } from '../../test'
import { setMockConfig } from '../lib/config'
import { query } from './query.js'
import { createStore, fakeFetch } from './test.js'

const config = testConfigFile()
beforeEach(async () => {
	setMockConfig(config)
})

test('refetch triggered by cache.refresh uses the most recent session, not the subscription-time session', async () => {
	const cache = new Cache()

	// write a record so the subscription has something to attach to
	const selection = {
		fields: {
			viewer: {
				type: 'User',
				visible: true,
				keyRaw: 'viewer',
				selection: {
					fields: {
						id: { type: 'ID', visible: true, keyRaw: 'id' },
						firstName: { type: 'String', visible: true, keyRaw: 'firstName' },
					},
				},
			},
		},
	}

	cache._internal_unstable.write({
		selection,
		data: { viewer: { id: '1', firstName: 'bob' } },
	})

	// spy to capture every network request and the session it carries
	const fetchSpy = vi.fn()

	const store = createStore({
		artifact: {
			kind: 'HoudiniQuery',
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Query',
			pluginData: {},
			stripVariables: [],
			selection,
		},
		pipeline: [query(cache), fakeFetch({ spy: fetchSpy })],
	})

	// first send — establishes the cache subscription with session 'old'
	await store.send({ session: { token: 'old' }, variables: {} })

	// second send with the same variables but a new session — no new subscription is created
	// but lastSession in the closure must be updated to 'new'
	await store.send({ session: { token: 'new' }, variables: {} })

	// reset the spy so we only see the refetch request
	fetchSpy.mockClear()

	// trigger a refetch via the cache
	cache._internal_unstable.refresh('User:1')

	// give the async send a tick to run
	await new Promise((r) => setTimeout(r, 0))

	// the refetch must carry the new session, not the stale one from subscription time
	expect(fetchSpy).toHaveBeenCalledOnce()
	expect(fetchSpy.mock.calls[0][0].session).toEqual({ token: 'new' })
})

test('query plugin evaluates runtime scalars', async () => {
	const fetchSpy = vi.fn()

	const cache = new Cache()

	const store = createStore({
		artifact: {
			kind: 'HoudiniQuery',
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Query',
			pluginData: {},
			enableLoadingState: 'local',
			input: {
				fields: {
					id: 'ID',
				},
				types: {},
				defaults: {},
				runtimeScalars: {
					id: 'ViewerIDFromSession',
				},
			},
			selection: {
				fields: {
					viewer: {
						type: 'User',
						visible: true,
						keyRaw: 'viewer',
						loading: { kind: 'continue' },
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
									loading: { kind: 'value' },
								},
								__typename: {
									type: 'String',
									visible: true,
									keyRaw: '__typename',
								},
							},
						},
					},
				},
			},
		},
		pipeline: [query(cache), fakeFetch({ spy: fetchSpy })],
	})

	// run the query with an artifact that contains runtime scalars
	await store.send({ session: { token: 'world' } })

	// the fetch spy should
	const ctx = fetchSpy.mock.calls[0][0]

	expect(ctx.variables).toEqual({ id: 'world' })
})
