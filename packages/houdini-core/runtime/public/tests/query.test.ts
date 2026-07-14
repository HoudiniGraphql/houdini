import { Cache } from '../../../../houdini/src/runtime/cache/index.js'
import { createPluginHooks, DocumentStore, HoudiniClient } from 'houdini/runtime/client'
import { ArtifactKind, CachePolicy, DataSource } from 'houdini/runtime/types'
import { beforeEach, expect, test, vi } from 'vitest'

import { testConfigFile } from '../../../../houdini/src/test/index.js'
import { setMockConfig } from '../../config.js'
import { query } from '../../plugins/query.js'

const config = testConfigFile()
beforeEach(async () => {
	setMockConfig(config)
})

test('refreshAll forwards fetch parameters to active queries', async () => {
	const cache = new Cache()

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

	cache.write({
		selection,
		data: { viewer: { id: '1', firstName: 'bob' } },
	})

	const fetchSpy = vi.fn()
	const fakeFetch = () => ({
		network(ctx, { resolve }) {
			fetchSpy(ctx)
			resolve(ctx, {
				data: { viewer: { id: '1', firstName: 'bob', __typename: 'User' } },
				errors: null,
				fetching: false,
				variables: null,
				source: DataSource.Network,
				partial: false,
				stale: false,
			})
		},
	})

	const artifact = {
		kind: ArtifactKind.Query,
		hash: '7777',
		raw: 'RAW_TEXT',
		name: 'TestArtifact',
		rootType: 'Query',
		pluginData: {},
		stripVariables: [],
		selection,
	}
	const client = new HoudiniClient({
		config: () => config,
		plugins: [query(cache), fakeFetch],
	})
	const store = new DocumentStore({
		client,
		plugins: createPluginHooks([query(cache), fakeFetch]),
		artifact,
		config,
	})

	await store.send({ session: { token: 'old' }, variables: {} })
	fetchSpy.mockClear()

	const abortController = new AbortController()
	cache.refreshAll({
		session: { token: 'new' },
		policy: CachePolicy.NoCache,
		metadata: { source: 'session-refresh' },
		abortController,
	})

	await new Promise((r) => setTimeout(r, 0))

	expect(fetchSpy).toHaveBeenCalledOnce()
	expect(fetchSpy.mock.calls[0][0]).toMatchObject({
		session: { token: 'new' },
		policy: CachePolicy.NoCache,
		metadata: { source: 'session-refresh' },
		abortController,
	})
})
