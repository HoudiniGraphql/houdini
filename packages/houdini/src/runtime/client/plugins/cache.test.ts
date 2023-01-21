import { beforeEach, expect, test, vi } from 'vitest'

import { HoudiniClient } from '..'
import { testConfigFile } from '../../../test'
import { Cache } from '../../cache/cache'
import { CachePolicy } from '../../lib'
import { setMockConfig } from '../../lib/config'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin } from '../documentStore'
import { DocumentStore } from '../documentStore'
import { cachePolicyPlugin } from './cache'

/**
 * Testing the cache plugin
 */
const config = testConfigFile()
beforeEach(async () => {
	setMockConfig({})
})

test('NetworkOnly', async function () {
	const setFetching = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])
	const ret1 = await store.send({ policy: CachePolicy.NetworkOnly })
	const ret2 = await store.send({ policy: CachePolicy.NetworkOnly })

	expect(setFetching).toHaveBeenCalledTimes(2)

	expect(ret1).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: {},
		source: 'network',
		partial: false,
		stale: false,
	})

	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: {},
		source: 'network',
		partial: false,
		stale: false,
	})
})

test('CacheOrNetwork', async function () {
	const setFetching = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])

	const ret1 = await store.send({ policy: CachePolicy.CacheOrNetwork })
	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	expect(setFetching).toHaveBeenCalledTimes(1)

	expect(ret1).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: {},
		source: 'network',
		partial: false,
		stale: false,
	})

	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
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
	const setFetching = vi.fn()
	const fn = vi.fn()

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching,
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])

	store.subscribe(fn)

	const ret1 = await store.send({ policy: CachePolicy.CacheOnly })

	expect(setFetching).toHaveBeenCalledTimes(0)

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
	expect(setFetching).toHaveBeenCalledTimes(1)
	expect(ret2).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: 'network',
		variables: {},
	})
	const ret3 = await store.send({ policy: CachePolicy.CacheOnly })

	// doesn't update the fetch value
	expect(setFetching).toHaveBeenCalledTimes(1)
	expect(ret3).toEqual({
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
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
	const setFetching = vi.fn()
	const fn = vi.fn()

	const cache = new Cache(config)

	const store = createStore([
		cachePolicyPlugin({
			enabled: true,
			setFetching,
			cache,
		}),
		fakeFetch({}),
	])

	store.subscribe(fn)

	const ret1 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	// Final return
	expect(ret1).toEqual({
		data: {
			viewer: {
				__typename: 'User',
				firstName: 'bob',
				id: '1',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		source: 'network',
		stale: false,
		variables: {},
	})

	// intermediate returns
	expect(fn).toHaveBeenNthCalledWith(1, {
		data: null,
		errors: null,
		fetching: true,
		partial: false,
		source: null,
		stale: false,
		variables: null,
	})

	// mark stale
	console.log(
		`cache._internal_unstable.staleManager`,
		cache._internal_unstable.staleManager.fieldsTime
	)

	cache._internal_unstable.staleManager.markTypeStale('User')

	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	// First final return with stale: true
	expect(ret2).toEqual({
		data: {
			viewer: {
				__typename: 'User',
				firstName: 'bob',
				id: '1',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		source: 'cache',
		stale: true,
		variables: {},
	})

	// intermediate returns
	expect(fn).toHaveBeenNthCalledWith(3, {
		data: {
			viewer: {
				__typename: 'User',
				firstName: 'bob',
				id: '1',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		source: 'cache',
		stale: true,
		variables: {},
	})

	// Doing a real network call in the end and returning the new data & stale false
	expect(fn).toHaveBeenNthCalledWith(4, {
		data: {
			viewer: {
				__typename: 'User',
				firstName: 'bob',
				id: '1',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		source: 'network',
		stale: false,
		variables: {},
	})
})

/**
 * Utilities for testing the cache plugin
 */
function createStore(plugins: ClientPlugin[]): DocumentStore<any, any> {
	const client = new HoudiniClient({
		url: 'URL',
	})

	return new DocumentStore({
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
								__typename: {
									type: 'String',
									keyRaw: '__typename',
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
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		partial: false,
		stale: false,
		source: DataSource.Network,
		variables: {},
	},
}) {
	return (() => ({
		network(ctx, { resolve }) {
			resolve(ctx, { ...result })
		},
	})) as ClientPlugin
}
