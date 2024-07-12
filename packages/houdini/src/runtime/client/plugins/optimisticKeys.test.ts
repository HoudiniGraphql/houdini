import { sleep } from '@kitql/helpers'
import { beforeEach, expect, test } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../../cache/cache'
import { setMockConfig } from '../../lib/config'
import { ArtifactKind, type QueryResult, type GraphQLObject } from '../../lib/types'
import { mutation } from './mutation'
import { optimisticKeys } from './optimisticKeys'
import { createStore, fakeFetch } from './test'

/**
 * Testing the cache plugin
 */
const config = testConfigFile()
beforeEach(async () => {
	setMockConfig({})
})

test('OptimisticKeys Plugin', async function () {
	const callbacks = {}
	const keys = {}

	// create a cache instance we can test against with the mutation plugin
	const cache = new Cache({ ...config, disabled: false })

	// we are going to block the mutation so we can look at the optimistic layers that are
	// created before the mutation resolves
	let resolveMutation: (() => void) | null = null

	const first = createStore({
		artifact: {
			kind: ArtifactKind.Mutation,
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Mutation',
			pluginData: {},
			optimisticKeys: true,
			selection: {
				fields: {
					createUser: {
						type: 'User',
						visible: true,
						keyRaw: 'createUser',
						loading: { kind: 'continue' },
						selection: {
							fields: {
								id: {
									type: 'ID',
									visible: true,
									keyRaw: 'id',
									optimisticKey: true,
									directives: [{ name: 'optimisticKey', arguments: {} }],
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
			input: {
				fields: {},
				types: {},
				defaults: {},
				runtimeScalars: {},
			},
		},
		pipeline: [
			optimisticKeys(cache, callbacks, keys),
			mutation(cache),
			fakeFetch({
				data: {
					createUser: { id: '1', firstName: 'Alice', __typename: 'User' },
				},
				onRequest: (variables, cb) => (resolveMutation = cb),
			}),
		],
	})

	// send the first mutation (this should block)
	first.send({
		stuff: {
			optimisticResponse: {
				createUser: { firstName: 'John' },
			},
		},
	})

	// since we can't await the send we are going to have to be a little creative with our timing
	await sleep(200)
	expect(resolveMutation).not.toBeNull()

	// we should have added an ID to the cache
	let optimisticLink = cache._internal_unstable.storage.data[0].links['_ROOT_']['createUser']
	expect(optimisticLink).toBeDefined()
	const record = cache._internal_unstable.storage.data[0].fields[optimisticLink as string]
	expect(record.id).toBeDefined()

	// now that we have an id, we can send a second mutation that will block until we resolve the first
	let secondVariables: GraphQLObject | null = null
	const second = createStore({
		artifact: {
			kind: ArtifactKind.Mutation,
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Mutation',
			pluginData: {},
			optimisticKeys: false,
			input: {
				fields: {
					id: 'String',
				},
				types: {},
				defaults: {},
				runtimeScalars: {},
			},
			selection: {
				fields: {
					createUser: {
						type: 'User',
						visible: true,
						keyRaw: 'createUser',
						loading: { kind: 'continue' },
						selection: {
							fields: {
								id: {
									type: 'ID',
									visible: true,
									keyRaw: 'id',
									optimisticKey: false,
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
		pipeline: [
			optimisticKeys(cache, callbacks, keys),
			fakeFetch({
				data: {
					createUser: { id: '2', firstName: 'Alice', __typename: 'User' },
				},
				onRequest: (variables, cb) => {
					secondVariables = variables
					cb()
				},
			}),
		],
	})

	// sending the second mutation with the optimistic ID as an input should block
	// until the first mutation resolves.
	let secondResolved: QueryResult | null = null
	second
		.send({
			variables: {
				id: record.id,
			},
		})
		.then((val) => (secondResolved = val))

	// wait for a bit, just to be sure
	await sleep(200)
	expect(secondResolved).toBeFalsy()

	// we can now resolve the first mutation (which will provide the ID for the second)
	if (resolveMutation) {
		// @ts-ignore
		resolveMutation?.()
	}

	// make sure we did get a value
	await sleep(200)
	expect(secondVariables).toEqual({ id: '1' })
	expect(secondResolved).toBeTruthy()
})
