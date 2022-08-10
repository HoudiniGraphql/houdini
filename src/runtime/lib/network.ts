import { LoadEvent, Page } from '@sveltejs/kit'

// @ts-ignore
// import { error, redirect } from '@sveltejs/kit/data'
import { isPrerender } from '../adapter'
import cache from '../cache'
import type { ConfigFile } from './config'
import * as log from './log'
import { marshalInputs } from './scalars'
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	MutationArtifact,
	QueryArtifact,
	QueryStore,
	QueryStoreFetchParams,
	SubscriptionArtifact,
} from './types'

const error = (status: number, message: string) => ({ status, message })
const redirect = (location: number, status: string) => ({ location, status })

export class HoudiniClient {
	private fetchFn: RequestHandler<any>
	socket: SubscriptionHandler | null | undefined

	constructor(networkFn: RequestHandler<any>, subscriptionHandler?: SubscriptionHandler | null) {
		this.fetchFn = networkFn
		this.socket = subscriptionHandler
	}

	async sendRequest<_Data>(
		ctx: FetchContext,
		params: FetchParams,
		session?: FetchSession
	): Promise<RequestPayloadMagic<_Data>> {
		let url = ''

		// wrap the user's fetch function so we can identify SSR by checking
		// the response.url
		const wrapper = async (...args: Parameters<FetchContext['fetch']>) => {
			const response = await ctx.fetch(...args)
			if (response.url) {
				url = response.url
			}

			return response
		}

		// invoke the function
		const result = await this.fetchFn.call(
			{
				...ctx,
				get fetch() {
					log.info(
						`${log.red(
							"⚠️ fetch and session are now passed as arguments to your client's network function ⚠️"
						)}
You should update your client to look something like the following:

async function fetchQuery({
	${log.yellow('fetch')},
	text = '',
	variables = {},
	${log.yellow('session')},
	metadata,
}: RequestHandlerArgs) {
	const result =  await fetch( ... );

	return await result.json();
}
`
					)
					return wrapper
				},
			},
			{
				fetch: wrapper,
				...params,
				get session() {
					// using session while prerendering is not meaningful
					if (isPrerender) {
						throw new Error(
							'Attempted to access session from a prerendered page. Session would never be populated.'
						)
					}

					return session
				},
				metadata: ctx.metadata,
			}
		)

		// return the result
		return {
			body: result,
			ssr: !url,
		}
	}

	init() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		currentClient = this
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


For more information, please visit this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0#environment
`
		)
	}
}

let currentClient: HoudiniClient | null = null

export function setEnvironment(env: HoudiniClient) {
	log.info(
		`${log.red('⚠️  setEnvironment is now replaced by environment.init() ⚠️')}
You should update your __layout files to look something like the following:

<script context="module">
  import client from 'path/to/client'

  client.init()
</script>


For more information, please visit this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0#environment
`
	)
	env.init()
}

export function getCurrentClient(): HoudiniClient | null {
	return currentClient
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
	fetch: (info: RequestInfo, init?: RequestInit) => Promise<Response>
	session: App.Session | null
	stuff: App.Stuff | null
	metadata?: App.Metadata | null
}

export type BeforeLoadContext = LoadEvent
export type AfterLoadContext = LoadEvent & {
	input: Record<string, any>
	data: Record<string, any>
}

export type KitLoadResponse = {
	status?: number
	error?: Error
	redirect?: string
	props?: Record<string, any>
	context?: Record<string, any>
	maxage?: number
}

export type FetchSession = any

type GraphQLError = {
	message: string
}

export type RequestPayloadMagic<_Data = any> = {
	ssr: boolean
	body: RequestPayload<_Data>
}

export type RequestPayload<_Data = any> = {
	data: _Data
	errors: {
		message: string
	}[]
}

/**
 * ## Tip 👇
 *
 * Create a file `src/app.d.ts` containing the following:
 *
 * ```ts
 * declare namespace App { *
 * 	interface Session {}
 * 	interface Metadata {}
 * }
 * ```
 *
 * Now Session and Metadata are typed everywhere!
 */
export type RequestHandlerArgs = Omit<FetchContext & FetchParams, 'stuff'>

export type RequestHandler<_Data> = (
	args: RequestHandlerArgs,
	session?: FetchSession
) => Promise<RequestPayload<_Data>>

// This function is responsible for simulating the fetch context, getting the current session and executing the fetchQuery.
// It is mainly used for mutations, refetch and possible other client side operations in the future.
export async function executeQuery<_Data extends GraphQLObject, _Input>({
	artifact,
	variables,
	session,
	cached,
	config,
	metadata,
	fetch,
}: {
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	session: App.Session | null
	cached: boolean
	config: ConfigFile
	// @ts-ignore
	metadata?: App.Metadata
	fetch?: LoadEvent['fetch']
}): Promise<{ result: RequestPayload; partial: boolean }> {
	// Simulate the fetch/load context
	const fetchCtx = {
		fetch: fetch ?? window.fetch.bind(window),
		session,
		stuff: {},
		page: {
			host: '',
			path: '',
			params: {},
			query: new URLSearchParams(),
		},
	}

	const { result: res, partial } = await fetchQuery<_Data, _Input>({
		context: { ...fetchCtx, metadata },
		config,
		artifact,
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

export type FetchQueryResult<_Data> = {
	result: RequestPayload<_Data | null>
	source: DataSource | null
	partial: boolean
}

export type QueryInputs<_Data> = FetchQueryResult<_Data> & { variables: { [key: string]: any } }

export async function fetchQuery<_Data extends GraphQLObject, _Input>({
	config,
	context,
	artifact,
	variables,
	cached = true,
	policy,
}: {
	config: ConfigFile
	context: FetchContext
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	cached?: boolean
	policy?: CachePolicy
}): Promise<FetchQueryResult<_Data>> {
	// grab the current environment
	const environment = currentClient
	// if there is no environment
	if (!environment) {
		return {
			result: { data: null, errors: [{ message: 'could not find houdini environment' }] },
			source: null,
			partial: false,
		}
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

	// the request must be resolved against the network
	const result = await environment.sendRequest<_Data>(
		context,
		{ text: artifact.raw, hash: artifact.hash, variables },
		context.session
	)

	return {
		result: result.body,
		source: result.ssr ? DataSource.Ssr : DataSource.Network,
		partial: false,
	}
}

export class RequestContext {
	private loadEvent: LoadEvent
	continue: boolean = true
	returnValue: {} = {}

	constructor(ctx: LoadEvent) {
		this.loadEvent = ctx
	}

	error(status: number, message: string | Error): any {
		throw error(status, typeof message === 'string' ? message : message.message)
	}

	redirect(status: number, location: string): any {
		throw redirect(status, location)
	}

	fetch(input: RequestInfo, init?: RequestInit) {
		// make sure to bind the window object to the fetch in a browser
		const fetch =
			typeof window !== 'undefined' ? this.loadEvent.fetch.bind(window) : this.loadEvent.fetch

		return fetch(input, init)
	}

	graphqlErrors(payload: { errors?: GraphQLError[] }) {
		// if we have a list of errors
		if (payload.errors) {
			return this.error(500, payload.errors.map(({ message }) => message).join('\n'))
		}

		return this.error(500, 'Encountered invalid response: ' + JSON.stringify(payload))
	}

	// This hook fires before executing any queries, it allows to redirect/error based on session state for example
	// It also allows to return custom props that should be returned from the corresponding load function.
	async invokeLoadHook({
		variant,
		hookFn,
		input,
		data,
	}: {
		variant: 'before' | 'after'
		hookFn: KitBeforeLoad | KitAfterLoad
		input: Record<string, any>
		data: Record<string, any>
	}) {
		// call the onLoad function to match the framework
		let hookCall
		if (variant === 'before') {
			hookCall = (hookFn as KitBeforeLoad).call(this, this.loadEvent as BeforeLoadContext)
		} else {
			hookCall = (hookFn as KitAfterLoad).call(this, {
				...this.loadEvent,
				input,
				data,
			} as AfterLoadContext)
		}

		let result = await hookCall

		// If the returnValue is already set through this.error or this.redirect return early
		if (!this.continue) {
			return
		}
		// If the result is null or undefined, or the result isn't an object return early
		if (result == null || typeof result !== 'object') {
			return
		}

		this.returnValue = result
	}

	// compute the inputs for an operation should reflect the framework's conventions.
	computeInput({
		config,
		variableFunction,
		artifact,
	}: {
		variableFunction: KitBeforeLoad
		artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
		config: ConfigFile
	}) {
		// call the variable function to match the framework
		let input = variableFunction.call(this, this.loadEvent)

		// and pass page and session
		return marshalInputs({ artifact, config, input })
	}
}

type KitBeforeLoad = (ctx: BeforeLoadContext) => Record<string, any>
type KitAfterLoad = (ctx: AfterLoadContext) => Record<string, any>

type LoadResult = Promise<{ [key: string]: QueryStore<unknown, unknown> }>
type LoadAllInput = LoadResult | Record<string, LoadResult>

export async function loadAll(
	loads: LoadAllInput[]
): Promise<Record<string, QueryStore<unknown, unknown>>> {
	// we need to collect all of the promises in a single list that we will await in promise.all and then build up
	const promises: LoadResult[] = []

	// the question we have to answer is wether entry is a promise or an object of promises
	const isPromise = (val: LoadAllInput): val is LoadResult =>
		'then' in val && 'finally' in val && 'catch' in val

	for (const entry of loads) {
		if (!isPromise(entry) && 'then' in entry) {
			throw new Error('❌ `then` is not a valid key for an object passed to loadAll')
		}

		// identify an entry with the `.then` method
		if (isPromise(entry)) {
			promises.push(entry)
		} else {
			for (const [key, value] of Object.entries(entry)) {
				if (isPromise(value)) {
					promises.push(value)
				} else {
					throw new Error(
						`❌ ${key} is not a valid value for an object passed to loadAll. You must pass the result of a load_Store function`
					)
				}
			}
		}
	}

	// now that we've collected all of the promises, wait for them
	await Promise.all(promises)

	// all of the promises are resolved so go back over the value we were given a reconstruct it
	let result = {}

	for (const entry of loads) {
		// if we're looking at a promise, it will contain the key
		if (isPromise(entry)) {
			Object.assign(result, await entry)
		} else {
			Object.assign(
				result,
				// await every value in the object and assign it to result
				Object.fromEntries(
					await Promise.all(
						Object.entries(entry).map(async ([key, value]) => [key, await value])
					)
				)
			)
		}
	}

	// we're done
	return result
}
