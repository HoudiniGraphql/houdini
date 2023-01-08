/// <reference path="../../../../../houdini.d.ts" />
import cache from '../cache'
import { extractFiles } from '../lib/networkUtils'
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	MutationArtifact,
	QueryArtifact,
	FetchQueryResult,
	DocumentArtifact,
} from '../lib/types'
import { DocumentObserver, HoudiniMiddleware } from './networkMiddleware'
import {
	marshalInputsMiddleware,
	queryMiddleware,
	mutationMiddleware,
	subscriptionMiddleware,
	cachePolicyMiddleware,
	fetchMiddleware,
	RequestHandler,
	FetchContext,
} from './operations'
import pluginMiddlewares from './plugin'

export class HoudiniClient {
	socket: SubscriptionHandler | null | undefined

	#middlewares: HoudiniMiddleware[]

	constructor({
		requestHandler,
		subscriptionHandler,
		middlewares = [],
	}: {
		requestHandler?: RequestHandler<any>
		subscriptionHandler?: SubscriptionHandler | null
		middlewares?: HoudiniMiddleware[]
	}) {
		this.socket = subscriptionHandler

		// we need to call the hooks in the appropriate order
		this.#middlewares = [
			// cache policy needs to always come first so that it
			cachePolicyMiddleware,
			...middlewares,
			...pluginMiddlewares,
			marshalInputsMiddleware,
			queryMiddleware,
			mutationMiddleware,
			subscriptionMiddleware,
		].concat(requestHandler ? [fetchMiddleware(requestHandler)] : [])
	}

	observe(artifact: DocumentArtifact) {
		return new DocumentObserver({ artifact, middlewares: this.#middlewares })
	}
}

export type SubscriptionHandler = {
	subscribe: (
		payload: { query: string; variables?: {} },
		handlers: {
			next: (payload: { data?: {}; errors?: readonly { message: string }[] }) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}

export async function fetchQuery<_Data extends GraphQLObject, _Input extends {}>({
	client,
	context,
	artifact,
	variables,
	setFetching,
	cached = true,
	policy,
}: {
	client: HoudiniClient
	context: FetchContext
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	setFetching: (fetching: boolean) => void
	cached?: boolean
	policy?: CachePolicy
}): Promise<FetchQueryResult<_Data>> {
	// if there is no environment
	if (!client) {
		throw new Error('could not find houdini environment')
	}

	// enforce cache policies for queries
	if (cached && artifact.kind === 'HoudiniQuery') {
		// if the user didn't specify a policy, use the artifacts
		if (!policy) {
			policy = artifact.policy
		}

		// this function is called as the first step in requesting data. If the policy prefers
		// cached data, we need to load data from the cache (if its available). If the policy
		// prefers network data we need to send a request (the onLoad of the component will
		// resolve the next data)

		// if the cache policy allows for cached data, look at the caches value first
		if (policy !== CachePolicy.NetworkOnly) {
			// look up the current value in the cache
			const value = cache.read({ selection: artifact.selection, variables })

			// if the result is partial and we dont allow it, dont return the value
			const allowed = !value.partial || artifact.partial

			// if we have data, use that unless its partial data and we dont allow that
			if (value.data !== null && allowed) {
				return {
					result: {
						data: value.data as _Data,
						errors: [],
					},
					source: DataSource.Cache,
					partial: value.partial,
				}
			}

			// if the policy is cacheOnly and we got this far, we need to return null (no network request will be sent)
			else if (policy === CachePolicy.CacheOnly) {
				return {
					result: {
						data: null,
						errors: [],
					},
					source: DataSource.Cache,
					partial: false,
				}
			}
		}
	}

	// tick the garbage collector asynchronously
	setTimeout(() => {
		cache._internal_unstable.collectGarbage()
	}, 0)

	// tell everyone that we are fetching if the function is defined
	setFetching(true)

	// the request must be resolved against the network
	// const result = await client.sendRequest<_Data>(context, {
	// 	text: artifact.raw,
	// 	hash: artifact.hash,
	// 	variables,
	// })

	// return {
	// 	result: result.body,
	// 	source: result.ssr ? DataSource.Ssr : DataSource.Network,
	// 	partial: false,
	// }

	return {
		result: { data: null, errors: [] },
		partial: false,
		source: DataSource.Network,
	}
}
