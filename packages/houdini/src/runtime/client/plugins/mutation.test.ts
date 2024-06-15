import { sleep } from '@kitql/helpers'
import { beforeEach, expect, test, vi } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache } from '../../cache/cache'
import { setMockConfig } from '../../lib/config'
import { ArtifactKind, SubscriptionSelection } from '../../lib/types'
import { injectOptimisticKeys, mutation } from './mutation'
import { createStore, fakeFetch } from './test'

/**
 * Testing the cache plugin
 */
const config = testConfigFile()
beforeEach(async () => {
	setMockConfig({})
})

test('MutationPlugin', async function () {
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
			mutation(cache),
			fakeFetch({
				data: {
					createUser: { id: '1', firstName: 'Alice', __typename: 'User' },
				},
				onRequest: (cb) => (resolveMutation = cb),
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
	let linkedID = cache._internal_unstable.storage.data[0].links['_ROOT_']['createUser']
	expect(linkedID).toBeDefined()
	const record = cache._internal_unstable.storage.data[0].fields[linkedID as string]
	expect(record.id).toBeDefined()

	// now that we have an id, we can send a second mutation that will block until we resolve the first
	const second = createStore({
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
			mutation(cache),
			fakeFetch({
				data: {
					createUser: { id: '1', firstName: 'Alice', __typename: 'User' },
				},
				onRequest: (cb) => (resolveMutation = cb),
			}),
		],
	})
})

test('injectOptimisticKeys', function () {
	const selection: SubscriptionSelection = {
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
	}

	// the place to store optimistic keys
	const keys = new Set<string>()

	// the optimistic response
	const input: { createUser: { firstName: string; id?: string } } = {
		createUser: {
			firstName: 'Alec',
		},
	}
	const result = injectOptimisticKeys(selection, input, keys)

	expect(result.createUser.id).toBeDefined()
})
