type FetchParams = {
	text: string
	variables: { [key: string]: any }
}

type RequestHandler = (params: FetchParams) => Promise<any>

export class Environment {
	private handler: RequestHandler

	constructor(networkFn: RequestHandler) {
		this.handler = networkFn
	}

	sendRequest(params: FetchParams) {
		return this.handler(params)
	}
}

let currentEnv: Environment | null = null

export function setEnvironment(env: Environment) {
	currentEnv = env
}

export function getEnvironment(): Environment | null {
	return currentEnv
}
