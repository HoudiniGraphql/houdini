import { Environment } from 'houdini'

// this function can take a second argument that will contain the session
// data during a request or mutation
export default new Environment(async function ({ text, variables = {} }) {
	// send the request to the ricky and morty api
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
})
