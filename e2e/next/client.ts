import type { RequestHandlerArgs } from '$houdini'
import { HoudiniClient } from '$houdini'

// For Query & Mutation
async function fetchQuery({ fetch, text = '', variables = {} }: RequestHandlerArgs) {
	// Prepare the request
	const url = 'http://localhost:4000/graphql'

	// regular fetch (Server & Client)
	const result = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})

	// return the result as a JSON object to Houdini
	const json = await result.json()

	return json
}

// Export the Houdini client
export default new HoudiniClient(fetchQuery)
