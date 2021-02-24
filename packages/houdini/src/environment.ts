type FetchParams = {
	text: string
	variables: { [key: string]: any }
}

export type FetchContext = {
	fetch: (url: string, options: {}) => Promise<{}>
	error: (code: number, mesage: string) => void
	redirect: (statusCode: number, location: string) => void
}

type RequestHandler = (this: FetchContext, params: FetchParams) => Promise<any>

export class Environment {
	private handler: RequestHandler

	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}

	sendRequest(ctx: FetchContext, params: FetchParams) {
		return this.handler.call(ctx, params)
	}
}

let currentEnv: Environment | null = null

export function setEnvironment(env: Environment) {
	currentEnv = env
}

export function getEnvironment(): Environment | null {
	return currentEnv
}
