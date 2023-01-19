import { beforeEach, expect, test, vi } from 'vitest'

import { HoudiniClient } from '..'
import { testConfigFile } from '../../../test'
import { Cache } from '../../cache/cache'
import { CachePolicy } from '../../lib'
import { setMockConfig } from '../../lib/config'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin } from './../documentObserver'
import { DocumentObserver } from './../documentObserver'
import { cachePolicyPlugin } from './cache'

/**
 * Testing the cache plugin
 */
const config = testConfigFile()
beforeEach(async () => {
	setMockConfig({})
})

test('NetworkOnly', async function () {
	const spy = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching: spy,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])
	const ret1 = await store.send({ policy: CachePolicy.NetworkOnly })
	const ret2 = await store.send({ policy: CachePolicy.NetworkOnly })

	expect(spy).toHaveBeenCalledTimes(2)

	expect(ret1).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})

	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})
})

test('CacheOrNetwork', async function () {
	const spy = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching: spy,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])
	const ret1 = await store.send({ policy: CachePolicy.CacheOrNetwork })
	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	expect(spy).toHaveBeenCalledTimes(1)

	expect(ret1).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})

	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: {},
		source: 'cache',
		partial: false,
		stale: false,
	})
})

test('CacheOnly', async function () {
	const spy = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching: spy,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])
	const ret1 = await store.send({ policy: CachePolicy.CacheOnly })

	expect(spy).toHaveBeenCalledTimes(0)

	expect(ret1).toEqual({
		data: null,
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: 'cache',
		variables: {},
	})
	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	// we should have set loading to true along the way
	expect(spy).toHaveBeenCalledTimes(1)
	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: 'network',
		variables: null,
	})
	const ret3 = await store.send({ policy: CachePolicy.CacheOnly })

	// doesn't update the fetch value
	expect(spy).toHaveBeenCalledTimes(1)
	expect(ret3).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: 'cache',
		variables: {},
	})
})

test('stale', async function () {
	const spy = vi.fn()

	const cache = new Cache(config)

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching: spy,
			cache,
		}),
		fakeFetch({}),
	])
	const ret1 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	expect(spy).toHaveBeenCalledTimes(1)

	expect(ret1).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})

	// I would like to access the public cache to do a "normal" cache update test
	cache._internal_unstable.staleManager.markTypeStale('User')

	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })
	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		variables: {},
		source: 'cache',
		partial: false,
		stale: true,
	})
})

/**
 * Utilities for testing the cache plugin
 */
function createStore(plugins: ClientPlugin[]): DocumentObserver<any, any> {
	const client = new HoudiniClient({
		url: 'URL',
	})

	return new DocumentObserver({
		client,
		pipeline: plugins,
		cache: true,
		artifact: {
			kind: ArtifactKind.Query,
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Query',
			selection: {
				fields: {
					viewer: {
						type: 'User',
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
							},
						},
					},
				},
			},
		},
	})
}

function fakeFetch({
	result = {
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: DataSource.Network,
		variables: null,
	},
}) {
	return (() => ({
		network(ctx, { resolve }) {
			resolve(ctx, { ...result })
		},
	})) as ClientPlugin
}
