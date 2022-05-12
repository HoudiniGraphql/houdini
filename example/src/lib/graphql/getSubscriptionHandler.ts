import { browser } from '$app/env'
import type { SubscriptionHandler } from '$houdini'
import { SubscriptionClient } from 'subscriptions-transport-ws'

export function getSubscriptionHandler(args: {
	/**
	 * url of your graphql endpoint.
	 */
	url: string
}) {
	let socketClient: SubscriptionHandler | null = null
	if (browser) {
		// instantiate the transport client
		const client = new SubscriptionClient(args.url, {
			reconnect: true,
		})

		// wrap the client in something houdini can use
		socketClient = {
			subscribe(payload, handlers) {
				// send the request
				const { unsubscribe } = client.request(payload).subscribe(handlers)

				// return the function to unsubscribe
				return unsubscribe
			},
		}
	}
	return socketClient
}
