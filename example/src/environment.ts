import { Environment } from '$houdini'
import { createClient } from 'graphql-ws'

// this function can take a second argument that will contain the session
// data during a request or mutation
async function fetchQuery({ text, variables = {} }) {
	const result = await this.fetch('http://localhost:4000', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})

	// parse the result as json
	return await result.json()
}

// this client is used to handle any socket connections that are made to the server
const socketClient = createClient({
	url: 'ws://localhost:4000',
})

export default new Environment(fetchQuery, socketClient)
