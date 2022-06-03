import { browser } from '$app/env'
import type { SubscriptionHandler } from '$houdini'
import { HoudiniClient } from '$houdini'
import { SubscriptionClient } from 'subscriptions-transport-ws'

// For Query & Mutation
async function fetchQuery({ text, variables = {} }, session: App.Session) {
	const result = await this.fetch('http://localhost:4000/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})
	return await result.json()
}

// For subscription (client only)
let socketClient: SubscriptionHandler | null = null
// if (browser) {
// 	const client = new SubscriptionClient('ws://localhost:4000/graphql', {
// 		reconnect: true,
// 	})

// 	socketClient = {
// 		subscribe(payload, handlers) {
// 			const { unsubscribe } = client.request(payload).subscribe(handlers)
// 			return unsubscribe
// 		},
// 	}
// }

// Export the Houdini client
export const houdiniClient = new HoudiniClient(fetchQuery, socketClient)
