export class Environment {
	private fetch: RequestHandler
	socket: SubscriptionHandler | null | undefined

	constructor(networkFn: RequestHandler, subscriptionHandler?: SubscriptionHandler | null) {
		this.fetch = networkFn
		this.socket = subscriptionHandler
	}

	sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession) {
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

export type FetchSession = any

type GraphQLError = {
	message: string
}

type RequestPayload = { data: any; errors?: Error[] }

export type RequestHandler = (
	this: FetchContext,
	params: FetchParams,
	session?: FetchSession
) => Promise<RequestPayload>

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export async function fetchQuery(
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

	return await environment.sendRequest(ctx, { text, variables }, session)
}

export class RequestContext {
	private context: FetchContext
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
		return this.context.fetch(input, init)
	}

	graphqlErrors(errors: GraphQLError[]) {
		return this.error(500, errors.map(({ message }) => message).join('\n'))
	}

	// compute the inputs for an operation should reflect the framework's conventions.
	// in sapper, this means preparing a `this` for the function. for kit, we can just pass
	// the context
	computeInput(mode: 'sapper' | 'kit', func: (value: any) => any) {
		// if we are in kit mode, just pass the context directly
		if (mode === 'kit') {
			return func(this.context)
		}

		// we are in sapper mode, so we need to prepare the function context
		// and pass page and session
		return func.call(this, [this.context.page, this.context.session])
	}
}
