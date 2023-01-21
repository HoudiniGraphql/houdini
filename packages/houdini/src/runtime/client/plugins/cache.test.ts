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
		variables: {},
		source: 'cache',
		partial: false,
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
		variables: null,
		source: 'network',
		partial: false,
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
		variables: {},
		source: 'cache',
		partial: false,
	})
})

/**
 * Utilities for testing the cache plugin
 */
export function createStore(plugins: ClientPlugin[]): DocumentStore<any, any> {
	const client = new HoudiniClient({
		url: 'URL',
		pipeline() {
			return plugins
		},
	})

	return new DocumentStore({
		pipeline: plugins,
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
		variables: null,
		source: DataSource.Network,
		partial: false,
	},
}) {
	return (() => ({
		network(ctx, { resolve }) {
			resolve(ctx, { ...result })
		},
	})) as ClientPlugin
}
