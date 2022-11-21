/// <reference path="../../../../../houdini.d.ts" />
import cache from '../cache'
import type { ConfigFile } from './config'
import * as log from './log'
import { extractFiles } from './networkUtils'
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	MutationArtifact,
	QueryArtifact,
	FetchQueryResult,
	RequestPayload,
	RequestPayloadMagic,
} from './types'

export class HoudiniClient {
	private fetchFn: RequestHandler<any>
	socket: SubscriptionHandler | null | undefined

	constructor(networkFn: RequestHandler<any>, subscriptionHandler?: SubscriptionHandler | null) {
		this.fetchFn = networkFn
		this.socket = subscriptionHandler
	}

	handleMultipart(
		params: FetchParams,
		args: Parameters<FetchContext['fetch']>
	): Parameters<FetchContext['fetch']> | undefined {
		// process any files that could be included
		const { clone, files } = extractFiles({
			query: params.text,
			variables: params.variables,
		})

		// if there are files in the request
		if (files.size) {
			const [url, req] = args
			let headers: Record<string, string> = {}

			// filters `content-type: application/json` if received by client.ts
			if (req?.headers) {
				const filtered = Object.entries(req?.headers).filter(([key, value]) => {
					return !(
						key.toLowerCase() == 'content-type' &&
						value.toLowerCase() == 'application/json'
					)
				})
				headers = Object.fromEntries(filtered)
			}

			// See the GraphQL multipart request spec:
			// https://github.com/jaydenseric/graphql-multipart-request-spec
			const form = new FormData()
			const operationJSON = JSON.stringify(clone)

			form.set('operations', operationJSON)

			const map: Record<string, Array<string>> = {}

			let i = 0
			files.forEach((paths) => {
				map[++i] = paths
			})
			form.set('map', JSON.stringify(map))

			i = 0
			files.forEach((paths, file) => {
				form.set(`${++i}`, file as Blob, (file as File).name)
			})

			return [url, { ...req, headers, body: form as any }]
		}
	}

	async sendRequest<_Data>(
		ctx: FetchContext,
		params: FetchParams
	): Promise<RequestPayloadMagic<_Data>> {
		let url = ''

		// invoke the function
		const result = await this.fetchFn({
			// wrap the user's fetch function so we can identify SSR by checking
			// the response.url
			fetch: async (...args: Parameters<FetchContext['fetch']>) => {
				// figure out if we need to do something special for multipart uploads
				const newArgs = this.handleMultipart(params, args)

				// use the new args if they exist, otherwise the old ones are good
				const response = await ctx.fetch(...(newArgs || args))
				if (response.url) {
					url = response.url
				}

				return response
			},
			...params,
			metadata: ctx.metadata,
			session: ctx.session || {},
		})

		// return the result
		return {
			body: result,
			ssr: !url,
		}
	}
}

export class Environment extends HoudiniClient {
	constructor(...args: ConstructorParameters<typeof HoudiniClient>) {
		super(...args)
		log.info(
			`${log.red('⚠️  Environment has been renamed to HoudiniClient. ⚠️')}
You should update your client to look something like the following:

import { HoudiniClient } from '$houdini/runtime'

export default new HoudiniClient(fetchQuery)
`
		)
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

export type FetchParams = {
	text: string
	hash: string
	variables: { [key: string]: any }
}

export type FetchContext = {
	fetch: typeof window.fetch
	metadata?: App.Metadata | null
	session: App.Session | null
}

/**
 * ## Tip 👇
 *
 * To define types for your metadata, create a file `src/app.d.ts` containing the followingI:
 *
 * ```ts
 * declare namespace App { *
 * 	interface Metadata {}
 * }
 * ```
 *
 */
export type RequestHandlerArgs = FetchContext &
	FetchParams & {
		session?: // @ts-ignore
		App.Session
	}

export type RequestHandler<_Data> = (args: RequestHandlerArgs) => Promise<RequestPayload<_Data>>

// This function is responsible for simulating the fetch context and executing the query with fetchQuery.
// It is mainly used for mutations, refetch and possible other client side operations in the future.
export async function executeQuery<_Data extends GraphQLObject, _Input extends {}>({
	client,
	artifact,
	variables,
	session,
	setFetching,
	cached,
	fetch,
	metadata,
}: {
	client: HoudiniClient
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	session: any
	setFetching: (fetching: boolean) => void
	cached: boolean
	config: ConfigFile
	fetch?: typeof globalThis.fetch
	metadata?: {}
}): Promise<{ result: RequestPayload; partial: boolean }> {
	const { result: res, partial } = await fetchQuery<_Data, _Input>({
		client,
		context: {
			fetch: fetch ?? globalThis.fetch.bind(globalThis),
			metadata,
			session,
		},
		artifact,
		setFetching,
		variables,
		cached,
	})

	// we could have gotten a null response
	if (res.errors && res.errors.length > 0) {
		throw res.errors
	}
	if (!res.data) {
		throw new Error('Encountered empty data response in payload')
	}

	return { result: res, partial }
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
	const result = await client.sendRequest<_Data>(context, {
		text: artifact.raw,
		hash: artifact.hash,
		variables,
	})

	return {
		result: result.body,
		source: result.ssr ? DataSource.Ssr : DataSource.Network,
		partial: false,
	}
}
