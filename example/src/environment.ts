import { Environment } from '$houdini'
import { createClient } from 'graphql-ws'

// this function can take a second argument that will contain the session
// data during a request or mutation
async function fetchQuery({ text, variables = {} }) {
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

	// parse the result as json
	return await result.json()
}

// this client is used to handle any socket connections that are made to the server
// since websockets only exist on the client, set to null on the server
const socketClient = (process as any).browser
	? createClient({
			url: 'ws://localhost:4000/graphql',
	  })
	: null

export default new Environment(fetchQuery, socketClient)
