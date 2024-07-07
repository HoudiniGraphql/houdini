import { vi } from 'vitest'

import { createPluginHooks, HoudiniClient, type HoudiniClientConstructorArgs } from '..'
import type { DocumentArtifact, GraphQLObject, QueryResult } from '../../lib'
import { ArtifactKind, DataSource } from '../../lib/types'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'
import { DocumentStore } from '../documentStore'

/**
 * Utilities for testing the cache plugin
 */
export function createStore(
	args: Partial<HoudiniClientConstructorArgs> & { artifact?: DocumentArtifact } = {}
): DocumentStore<any, any> {
	// if we dont have anything passed, just use the fake fetch as the plugin
	if (!args.plugins && !args.pipeline) {
		args.plugins = [fakeFetch({})]
	}

	// instantiate the client
	const client = new HoudiniClient({
		url: 'URL',
		...args,
	})

	return new DocumentStore({
		plugins: args.plugins ? createPluginHooks(client.plugins) : undefined,
		pipeline: args.pipeline ? createPluginHooks(client.plugins) : undefined,
		client,
		artifact: args.artifact ?? {
			kind: ArtifactKind.Query,
			hash: '7777',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Query',
			pluginData: {},
			enableLoadingState: 'local',
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
	})
}

export function fakeFetch({
	data,
	spy = vi.fn(),
	onRequest,
}: {
	data?: any
	spy?: (ctx: ClientPluginContext) => void
	onRequest?: (variables: GraphQLObject, cb: () => void) => void
}) {
	const result: QueryResult = {
		data: data ?? {
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
	}

	return (() => ({
		network(ctx, { resolve }) {
			spy?.(ctx)
			if (onRequest) {
				onRequest(ctx.variables ?? {}, () => resolve(ctx, { ...result }))
			} else {
				resolve(ctx, { ...result })
			}
		},
	})) as ClientPlugin
}
