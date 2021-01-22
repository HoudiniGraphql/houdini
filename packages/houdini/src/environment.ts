// externals
import { getContext, setContext } from 'svelte'

type FetchParams = {
	text: string
	variables: { [key: string]: any }
}

type RequestHandler = <ResponseType>(params: FetchParams) => Promise<ResponseType>

export class Environment {
	private handler: RequestHandler

	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}

	sendRequest<_ResponseType>(params: FetchParams) {
		return this.handler<_ResponseType>(params)
	}
}

export let currentEnv: Environment | null = null

export function setEnvironment(env: Environment) {
	currentEnv = env
}
