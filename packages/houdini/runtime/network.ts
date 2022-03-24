// externals
import { get, Readable } from 'svelte/store'
import type { Config } from 'houdini-common'
// locals
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	MutationArtifact,
	QueryArtifact,
	SubscriptionArtifact,
} from './types'
import { marshalInputs } from './scalars'
import cache from './cache'
import { rootID } from './cache/cache'

export class Environment {
	private fetch: RequestHandler<any>
	socket: SubscriptionHandler | null | undefined

	constructor(networkFn: RequestHandler<any>, subscriptionHandler?: SubscriptionHandler | null) {
		this.fetch = networkFn
		this.socket = subscriptionHandler
	}

	sendRequest<_Data>(ctx: FetchContext, params: FetchParams, session?: FetchSession) {
		return this.fetch.call(ctx, params, session)
	}
}

let currentEnv: Environment | null = null

export function setEnvironment(env: Environment) {
	currentEnv = env
}

export function getEnvironment(): Environment | null {
	return currentEnv
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
	page: {
		host: string
		path: string
		params: Record<string, string | string[]>
		query: URLSearchParams
	}
	fetch: (info: RequestInfo, init?: RequestInit) => Promise<Response>
	session: any
	stuff: Record<string, any>
}

export type BeforeLoadContext = FetchContext
export type AfterLoadContext = FetchContext & {
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

export type RequestPayload<_Data = any> = {
	data: _Data
	errors: {
		message: string
	}[]
}

export type RequestHandler<_Data> = (
	this: FetchContext,
	params: FetchParams,
	session?: FetchSession
) => Promise<RequestPayload<_Data>>

// This function is responsible for simulating the fetch context, getting the current session and executing the fetchQuery.
// It is mainly used for mutations, refetch and possible other client side operations in the future.
export async function executeQuery<_Data extends GraphQLObject, _Input>(
	artifact: QueryArtifact | MutationArtifact,
	variables: _Input,
	sessionStore: Readable<any>,
	cached: boolean
): Promise<RequestPayload> {
	// We use get from svelte/store here to subscribe to the current value and unsubscribe after.
	// Maybe there can be a better solution and subscribing only once?
	const session = get(sessionStore)

	// Simulate the fetch/load context
	const fetchCtx = {
		fetch: window.fetch.bind(window),
		session,
		stuff: {},
		page: {
			host: '',
			path: '',
			params: {},
			query: new URLSearchParams(),
		},
	}

	const [res] = await fetchQuery<_Data>({
		context: fetchCtx,
		artifact,
		session,
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

	return res
}

// convertKitPayload is responsible for taking the result of kit's load
export async function convertKitPayload(
	context: RequestContext,
	loader: (ctx: FetchContext) => Promise<KitLoadResponse>,
	page: FetchContext['page'],
	session: FetchContext['session']
) {
	// invoke the loader
	const result = await loader({
		page,
		session,
		stuff: {},
		fetch: context.fetch,
	})

	// if the response contains an error
	if (result.error) {
		// 500 - internal server error
		context.error(result.status || 500, result.error)
		return
	}
	// if the response contains a redirect
	if (result.redirect) {
		// 307 - temporary redirect
		context.redirect(result.status || 307, result.redirect)
		return
	}
	// the response contains data!
	if (result.props) {
		return result.props
	}

	// we shouldn't get here
	throw new Error('Could not handle response from loader: ' + JSON.stringify(result))
}

export async function fetchQuery<_Data extends GraphQLObject>({
	context,
	artifact,
	variables,
	session,
	cached = true,
}: {
	context: FetchContext
	artifact: QueryArtifact | MutationArtifact
	variables: {}
	session?: FetchSession
	cached?: boolean
}): Promise<[RequestPayload<_Data | {} | null>, DataSource | null]> {
	// grab the current environment
	const environment = getEnvironment()
	// if there is no environment
	if (!environment) {
		return {
			data: { data: {}, errors: [{ message: 'could not find houdini environment' }] },
			source: null,
		}
	}

	// enforce cache policies for queries
	if (cached && artifact.kind === 'HoudiniQuery') {
		// tick the garbage collector asynchronously
		setTimeout(() => {
			cache._internal_unstable.collectGarbage()
		}, 0)

		// this function is called as the first step in requesting data. If the policy prefers
		// cached data, we need to load data from the cache (if its available). If the policy
		// prefers network data we need to send a request (the onLoad of the component will
		// resolve the next data)

		// if the policy says network only, dont do anything here - the mountMount of the query
		// will handle it
		if (artifact.policy !== CachePolicy.NetworkOnly) {
			// look up the current value in the cache
			const value = cache.read({ selection: artifact.selection, variables })

			// if the policy allows for cached values and we have some
			if (value.data !== null) {
				return {
					data: {
						data: value.data,
						errors: [],
					},
					source: DataSource.Cache,
					partial: value.partial,
				}
			}

			// if the policy is cacheOnly and we got this far, we need to return null
			else if (artifact.policy === CachePolicy.CacheOnly) {
				return {
					data: {
						data: null,
						errors: [],
					},
					source: DataSource.Cache,
					partial: false,
				}
			}
		}
	}

	// the request must be resolved against the network

	return {
		data: await environment.sendRequest<_Data>(
			context,
			{ text: artifact.raw, hash: artifact.hash, variables },
			session
		),
		source: DataSource.Network,
		partial: false,
	}
}

export class RequestContext {
	context: FetchContext
	continue: boolean = true
	returnValue: {} = {}

	constructor(ctx: FetchContext) {
		this.context = ctx
	}

	error(status: number, message: string | Error) {
		this.continue = false
		this.returnValue = {
			error: message,
			status,
		}
	}

	redirect(status: number, location: string) {
		this.continue = false
		this.returnValue = {
			redirect: location,
			status,
		}
	}

	fetch(input: RequestInfo, init?: RequestInit) {
		// make sure to bind the window object to the fetch in a browser
		const fetch =
			typeof window !== 'undefined' ? this.context.fetch.bind(window) : this.context.fetch

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
		mode,
		hookFn,
		data,
	}: {
		variant: 'before' | 'after'
		mode: 'kit' | 'sapper'
		hookFn: KitBeforeLoad | KitAfterLoad | SapperBeforeLoad | SapperAfterLoad
		data: Record<string, any>
	}) {
		// call the onLoad function to match the framework
		let hookCall
		if (mode === 'kit') {
			if (variant === 'before') {
				hookCall = (hookFn as KitBeforeLoad).call(this, this.context as BeforeLoadContext)
			} else {
				hookCall = (hookFn as KitAfterLoad).call(this, {
					...this.context,
					data,
				} as AfterLoadContext)
			}
		} else {
			// sapper
			if (variant === 'before') {
				hookCall = (hookFn as SapperBeforeLoad).call(
					this,
					this.context.page,
					this.context.session
				)
			} else {
				hookCall = (hookFn as SapperAfterLoad).call(
					this,
					this.context.page,
					this.context.session,
					data
				)
			}
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
	// in sapper, this means preparing a `this` for the function. for kit, we can just pass
	// the context
	computeInput({
		config,
		mode,
		variableFunction,
		artifact,
	}: {
		mode: 'kit' | 'sapper'
		variableFunction: SapperBeforeLoad | KitBeforeLoad
		artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
		config: Config
	}) {
		// call the variable function to match the framework
		let input =
			mode === 'kit'
				? // in kit just pass the context directly
				  (variableFunction as KitBeforeLoad).call(this, this.context)
				: // we are in sapper mode, so we need to prepare the function context
				  (variableFunction as SapperBeforeLoad).call(
						this,
						this.context.page,
						this.context.session
				  )

		// and pass page and session
		return marshalInputs({ artifact, config, input })
	}
}

type SapperBeforeLoad = (
	page: FetchContext['page'],
	session: FetchContext['session']
) => Record<string, any>
type SapperAfterLoad = (
	page: FetchContext['page'],
	session: FetchContext['session'],
	data: Record<string, any>
) => Record<string, any>

type KitBeforeLoad = (ctx: BeforeLoadContext) => Record<string, any>
type KitAfterLoad = (ctx: AfterLoadContext) => Record<string, any>
