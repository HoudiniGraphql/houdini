import { docs } from '../../cache/data'

/**
 * @type {import('@sveltejs/kit').RequestHandler}
 */
export async function get({ query }) {
	const queryString = query.get('q')

	const results = queryString
		? docs.filter((doc) => doc.content.toLowerCase().includes(queryString))
		: []
	return {
		status: 200,
		body: {
			result: JSON.stringify(results),
		},
		headers: {
			'Content-Type': 'application/json',
		},
	}
}
