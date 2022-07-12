import { browser } from '$app/env'
import type { RequestHandlerArgs, SubscriptionHandler } from '$houdini'
import { HoudiniClient } from '$houdini'
import { createClient as createWSClient } from 'graphql-ws'

// For Query & Mutation
async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	session,
	metadata,
}: RequestHandlerArgs) {
	const result = await fetch('http://localhost:4000/graphql', {
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
if (browser) {
	socketClient = createWSClient({
		url: 'ws://localhost:4000/graphql',
	})
}

// Export the Houdini client
export const houdiniClient = new HoudiniClient(fetchQuery, socketClient)
