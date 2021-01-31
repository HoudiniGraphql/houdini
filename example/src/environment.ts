import { Environment } from 'houdini'
import fetch from 'cross-fetch'

export default new Environment(async ({ text, variables = {} }) => {
	// send the request to the ricky and morty api
	const result = await fetch('http://localhost:4000', {
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
})
