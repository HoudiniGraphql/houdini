import { error, LoadEvent, redirect, RequestEvent } from '@sveltejs/kit'
import { get_current_component } from 'svelte/internal'
import { get } from 'svelte/store'

import { isBrowser, isDev } from '../adapter'
import cache from '../cache'
import { QueryResult } from '../stores/query'
import type { ConfigFile } from './config'
import * as log from './log'
import { marshalInputs } from './scalars'
import {
	CachePolicy,
	DataSource,
	GraphQLObject,
	MutationArtifact,
	QueryArtifact,
	SubscriptionArtifact,
} from './types'

export const sessionKeyName = 'HOUDINI_SESSION_KEY_NAME'

export class HoudiniClient<SessionData = undefined> {
	private fetchFn: RequestHandler<any, SessionData | undefined>
	socket: SubscriptionHandler | null | undefined
	private clientSideSession: SessionData | undefined

	constructor(
		networkFn: RequestHandler<any, SessionData | undefined>,
		subscriptionHandler?: SubscriptionHandler | null
	) {
		this.fetchFn = networkFn
		this.socket = subscriptionHandler
	}

	async sendRequest<_Data>(
		ctx: FetchContext,
		params: FetchParams,
		session: SessionData | undefined
	): Promise<RequestPayloadMagic<_Data>> {
		let url = ''

		// invoke the function
		const result = await this.fetchFn({
			// wrap the user's fetch function so we can identify SSR by checking
			// the response.url
			fetch: async (...args: Parameters<FetchContext['fetch']>) => {
				const response = await ctx.fetch(...args)
				if (response.url) {
					url = response.url
				}

				return response
			},
			...params,
			metadata: ctx.metadata,
			session: this.clientSideSession || session,
		})

		// return the result
		return {
			body: result,
			ssr: !url,
		}
	}

	init() {}

	setServerSession(event: RequestEvent, session: SessionData) {
		;(event.locals as any)[sessionKeyName] = session
	}

	passServerSession(event: RequestEvent): {} {
		if (isDev && !(sessionKeyName in event.locals)) {
			// todo: Warn the user that houdini session is not setup correctly.
		}

		return {
			[sessionKeyName]: (event.locals as any)[sessionKeyName],
		}
	}

	receiveServerSession(data: {}) {
		// This may only be called during initialization of a component.
		// This is not really a technical limitation but to prevent users from sharing data on the server.

		// This call will throw outside of component initialization.
		get_current_component()

		this.clientSideSession = (data as any)[sessionKeyName]
	}

	setSession(session: SessionData) {
		// This may not be called on the server. Otherwise multiple requests would share the session as this class is a global singleton on the server.
		if (!isBrowser) {
			// todo: Warn the user about the above fact.
			throw new Error()
		}

		this.clientSideSession = session
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
	// @ts-ignore
	metadata?: App.Metadata | null
}

export type BeforeLoadArgs = LoadEvent
export type AfterLoadArgs = LoadEvent & {
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
 * To define types for your metadata, create a file `src/app.d.ts` containing the followingI:
 *
 * ```ts
 * declare namespace App { *
 * 	interface Metadata {}
 * }
 * ```
 *
 */
export type RequestHandlerArgs<SessionData> = FetchContext & FetchParams & { session: SessionData }

export type RequestHandler<_Data, SessionData> = (
	args: RequestHandlerArgs<SessionData>
) => Promise<RequestPayload<_Data>>

// This function is responsible for simulating the fetch context and executing the query with fetchQuery.
// It is mainly used for mutations, refetch and possible other client side operations in the future.
export async function executeQuery<_Data extends GraphQLObject, _Input>({
	artifact,
	variables,
	session,
	cached,
	fetch,
	metadata,
}: {
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	session: any
	cached: boolean
	config: ConfigFile
	fetch?: typeof globalThis.fetch
	metadata?: {}
}): Promise<{ result: RequestPayload; partial: boolean }> {
	const { result: res, partial } = await fetchQuery<_Data, _Input>({
		context: {
			fetch: fetch ?? globalThis.fetch.bind(globalThis),
			metadata,
		},
		artifact,
		variables,
		session,
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

export async function getCurrentClient(): Promise<HoudiniClient<any>> {
	// @ts-ignore
	return (await import('HOUDINI_CLIENT_PATH')).default
}

export async function fetchQuery<_Data extends GraphQLObject, _Input>({
	artifact,
	variables,
	session,
	cached = true,
	policy,
	context,
}: {
	context: FetchContext
	artifact: QueryArtifact | MutationArtifact
	variables: _Input
	session: any
	cached?: boolean
	policy?: CachePolicy
}): Promise<FetchQueryResult<_Data>> {
	const client = await getCurrentClient()

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

	// the request must be resolved against the network
	const result = await client.sendRequest<_Data>(
		context,
		{
			text: artifact.raw,
			hash: artifact.hash,
			variables,
		},
		session
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

	// This hook fires before executing any queries, it allows custom props to be passed to the component.
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
			hookCall = (hookFn as KitBeforeLoad).call(this, this.loadEvent as BeforeLoadArgs)
		} else {
			// we have to assign input and data onto load so that we don't read values that
			// are deprecated
			Object.assign(this.loadEvent, {
				input,
				data: Object.fromEntries(
					Object.entries(data).map(([key, store]) => [
						key,
						get<QueryResult<any, any>>(store).data,
					])
				),
			})
			hookCall = (hookFn as KitAfterLoad).call(this, this.loadEvent as AfterLoadArgs)
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
	async computeInput({
		variableFunction,
		artifact,
	}: {
		variableFunction: KitBeforeLoad
		artifact: QueryArtifact | MutationArtifact | SubscriptionArtifact
	}) {
		// call the variable function to match the framework
		let input = await variableFunction.call(this, this.loadEvent)

		return await marshalInputs({ artifact, input })
	}
}

type KitBeforeLoad = (ctx: BeforeLoadArgs) => Record<string, any> | Promise<Record<string, any>>
type KitAfterLoad = (ctx: AfterLoadArgs) => Record<string, any>
