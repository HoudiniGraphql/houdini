import { Environment, SubscriptionHandler } from '$houdini'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import { browser } from '$app/env'

const API_URL = 'localhost:4000/graphql'

// this function can take a second argument that will contain the session
// data during a request or mutation
async function fetchQuery({ text, variables = {} }) {
	const result = await this.fetch('http://' + API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query: text,
			variables
		})
	})

	// parse the result as json
	return await result.json()
}

// this client is used to handle any socket connections that are made to the api
// since websockets only exist on the client, set to null on the server
let socketClient: SubscriptionHandler | null = null
if (browser) {
	// instantiate the transport client
	const client = new SubscriptionClient('ws://' + API_URL, {
		reconnect: true
	})

	// wrap the client in something houdini can use
	socketClient = {
		subscribe(payload, handlers) {
			// send the request
			const { unsubscribe } = client.request(payload).subscribe(handlers)

			// return the function to unsubscribe
			return unsubscribe
		}
	}
}

export default new Environment(fetchQuery, socketClient)
