import { beforeEach, expect, test, vi } from 'vitest'

import { createPluginHooks, HoudiniClient } from '..'
import { testConfigFile } from '../../../test'
import { Cache } from '../../cache/cache'
import { CachePolicy } from '../../lib'
import { setMockConfig } from '../../lib/config'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin } from '../documentStore'
import { DocumentStore } from '../documentStore'
import { cachePolicy } from './cache'

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
		cachePolicy({
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
				__typename: 'User',
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
				__typename: 'User',
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
		cachePolicy({
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
				__typename: 'User',
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
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'cache',
		partial: false,
		stale: false,
	})
})

test('CacheAndNetwork', async function () {
	const spy = vi.fn()

	const store = createStore([
		cachePolicy({
			enabled: true,
			setFetching: () => {},
			cache: new Cache(config),
		}),
		fakeFetch({}),
	])
	store.subscribe(spy)
	await store.send({ policy: CachePolicy.CacheAndNetwork })
	await store.send({ policy: CachePolicy.CacheAndNetwork })

	expect(spy).toHaveBeenNthCalledWith(2, {
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})

	expect(spy).toHaveBeenNthCalledWith(3, {
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
			},
		},
		errors: null,
		fetching: false,
		variables: null,
		source: 'cache',
		partial: false,
		stale: false,
	})
	expect(spy).toHaveBeenNthCalledWith(4, {
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
				__typename: 'User',
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

test('CacheOnly', async function () {
	const spy = vi.fn()

	const store = createStore([
		cachePolicy({
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
		variables: null,
		source: 'cache',
		partial: false,
		stale: false,
	})
	const ret2 = await store.send({ policy: CachePolicy.CacheOrNetwork })

	// we should have set loading to true along the way
	expect(spy).toHaveBeenCalledTimes(1)
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
		variables: null,
		source: 'network',
		partial: false,
		stale: false,
	})
	const ret3 = await store.send({ policy: CachePolicy.CacheOnly })

	// doesn't update the fetch value
	expect(spy).toHaveBeenCalledTimes(1)
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
		variables: null,
		source: 'cache',
		partial: false,
		stale: false,
	})
})

test('stale', async function () {
	const setFetching = vi.fn()
	const fn = vi.fn()

	const cache = new Cache(config)

	const store = createStore([
		cachePolicy({
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
		variables: null,
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

	//  mark stale
	cache.markTypeStale({ type: 'User' })

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
		variables: null,
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
		variables: null,
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
		variables: null,
	})
})

/**
 * Utilities for testing the cache plugin
 */
export function createStore(plugins: ClientPlugin[]): DocumentStore<any, any> {
	const client = new HoudiniClient({
		url: 'URL',
		pipeline: [...plugins],
	})

	return new DocumentStore({
		pipeline: createPluginHooks(plugins),
		client,
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
		variables: null,
		source: DataSource.Network,
		partial: false,
		stale: false,
	},
}) {
	return (() => ({
		network(ctx, { resolve }) {
			resolve(ctx, { ...result })
		},
	})) as ClientPlugin
}
