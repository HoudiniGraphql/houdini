import { beforeEach, expect, test, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { setMockConfig } from '../../lib/config'
import { createStore, fakeFetch } from './cache.test'
import { query } from './query'

const config = testConfigFile()
beforeEach(async () => {
	setMockConfig(config)
})

test('query plugin evaluates runtime scalars', async function () {
	const fetchSpy = vi.fn()

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
		pipeline: [query, fakeFetch({ spy: fetchSpy })],
	})

	// run the query with an artifact that contains runtime scalars
	await store.send({ session: { token: 'world' } })

	// the fetch spy should
	const ctx = fetchSpy.mock.calls[0][0]

	expect(ctx.variables).toEqual({ id: 'world' })
})
