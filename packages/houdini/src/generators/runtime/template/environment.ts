type FetchParams = {
	text: string
	variables: { [key: string]: any }
}

export type FetchContext = {
	fetch: typeof window.fetch
	error: (code: number, mesage: string | Error) => void
	redirect: (statusCode: number, location: string) => void
}

export type FetchSession = any

type RequestPayload = { data: any; errors?: Error[] }

type RequestHandler = (
	this: FetchContext,
	params: FetchParams,
	session?: FetchSession
) => Promise<RequestPayload>

export class Environment {
	private handler: RequestHandler

	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}

	sendRequest(
		ctx: FetchContext,
		params: FetchParams,
		session?: FetchSession
	): Promise<RequestPayload> {
		return this.handler.call(ctx, params, session)
	}
}

let currentEnv: Environment | null = null

export function setEnvironment(env: Environment) {
	currentEnv = env
}

export function getEnvironment(): Environment | null {
	return currentEnv
}
