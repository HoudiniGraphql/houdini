// externals
import { getContext, setContext } from 'svelte'

// a context key to store and retrieve the environment
const environmentCtxKey = {}

export function setEnvironment(env: Environment) {
	// emebed the environment in context
	setContext(environmentCtxKey, env)
}

export function getEnvironment(): Environment {
	return getContext(environmentCtxKey)
}

type FetchParams = {
	text: string
	variables: { [key: string]: any }
}

type RequestHandler = <ResponseType>(params: FetchParams) => Promise<ResponseType>

export class Environment {
	private handler: RequestHandler = null

	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}

	sendRequest<_ResponseType>(params: FetchParams) {
		return this.handler<_ResponseType>(params)
	}
}
