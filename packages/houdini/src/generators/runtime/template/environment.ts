import type { SubscriptionHandler } from './network'
import type { RequestHandler, FetchContext, FetchParams, FetchSession } from './network'

export class Environment {
	private fetch: RequestHandler
	socket: SubscriptionHandler | null | undefined

	// this project uses subscriptions so make sure one is passed when constructing an environment
	constructor(networkFn: RequestHandler, subscriptionHandler?: SubscriptionHandler | null) {
		this.fetch = networkFn
		this.socket = subscriptionHandler
	}

	sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession) {
		return this.fetch.call(ctx, params, session)
	}
}
