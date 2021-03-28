import type { SubscriptionHandler } from './network'
import type { RequestHandler, FetchContext, FetchParams, FetchSession } from './network'

// this is a local declaration to typecheck at package build-time. it will get overwritten
// by one that acommodates the user's specifics when the runtime is generated.
export declare class Environment {
	private fetch
	socket: SubscriptionHandler | null
	constructor(networkFn: RequestHandler, subscriptionHandler: SubscriptionHandler | null)
	sendRequest(
		ctx: FetchContext,
		params: FetchParams,
		session?: FetchSession
	): Promise<{
		data: any
		errors?: Error[] | undefined
	}>
}
