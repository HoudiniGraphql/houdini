// externals
import { get, Readable } from 'svelte/store'
// locals
import { MutationArtifact, QueryArtifact } from './types'

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
	context: Record<string, any>
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

export type RequestPayload<_Data> = {
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
export async function executeQuery<_Data>(
	artifact: QueryArtifact | MutationArtifact,
	variables: { [key: string]: any },
	sessionStore: Readable<any>
): Promise<RequestPayload<_Data>> {
	// We use get from svelte/store here to subscribe to the current value and unsubscribe after.
	// Maybe there can be a better solution and subscribing only once?
	const session = get(sessionStore)

	// Simulate the fetch/load context
	const fetchCtx = {
		fetch: window.fetch.bind(window),
		session,
		context: {},
		page: {
			host: '',
			path: '',
			params: {},
			query: new URLSearchParams(),
		},
	}

	// pull the query text out of the compiled artifact
	const { raw: text } = artifact

	const res = await fetchQuery<_Data>(
		fetchCtx,
		{
			text,
			variables,
		},
		session
	)

	// we could have gotten a null response
	if (res.errors) {
		throw res.errors
	}
	if (!res.data) {
		throw new Error('Encountered empty data response in payload')
	}

	return res
}

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export async function fetchQuery<_Data>(
	ctx: FetchContext,
	{
		text,
		variables,
	}: {
		text: string
		variables: { [name: string]: unknown }
	},
	session?: FetchSession
) {
	// grab the current environment
	const environment = getEnvironment()
	// if there is no environment
	if (!environment) {
		return { data: {}, errors: [{ message: 'could not find houdini environment' }] }
	}

	return await environment.sendRequest<_Data>(ctx, { text, variables }, session)
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
		context,
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
			console.log('registering graphql errors', payload.errors)
			return this.error(500, payload.errors.map(({ message }) => message).join('\n'))
		}

		return this.error(500, 'Encountered invalid response: ' + JSON.stringify(payload))
	}

	// compute the inputs for an operation should reflect the framework's conventions.
	// in sapper, this means preparing a `this` for the function. for kit, we can just pass
	// the context
	computeInput(mode: 'kit', func: (ctx: FetchContext) => {}): {}
	computeInput(
		mode: 'sapper',
		func: (page: FetchContext['page'], session: FetchContext['session']) => {}
	): {}
	computeInput(mode: 'sapper' | 'kit', func: any): {} {
		// if we are in kit mode, just pass the context directly
		if (mode === 'kit') {
			return func.call(this, this.context)
		}

		// we are in sapper mode, so we need to prepare the function context
		// and pass page and session
		return func.call(this, this.context.page, this.context.session)
	}
}
