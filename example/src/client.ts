import { browser } from '$app/environment'
import { HoudiniClient, type SubscriptionHandler } from '$houdini'
import { subscriptionPlugin } from '$houdini/plugins'
import { createClient as createWSClient } from 'graphql-ws'

// For subscription (client only)
let socketClient: SubscriptionHandler | null = null
if (browser) {
	// @ts-ignore
	socketClient = createWSClient({
		url: 'ws://localhost:4000/graphql',
	})
}

export default new HoudiniClient({
	url: 'http://localhost:4000/graphql',
	plugins: [subscriptionPlugin(socketClient)],
})
