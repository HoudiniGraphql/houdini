export function buildFetchQueryFn<HeadersType extends Record<string, string>>(args: {
	/**
	 * url of your graphql endpoint.
	 */
	url: string
	/**
	 * Headers of your requests to graphql endpoint
	 * if no Content-Type is set, 'application/json' will be used. (FYI: 'application/graphql+json' is a great new content type for GraphQL!)
	 */
	headers?: HeadersType
	/**
	 * More info there: https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials
	 * @Default omit Secure by default.
	 */
	credentials?: 'omit' | 'same-origin' | 'include'
}) {
	return async function fetchQuery({ text, variables = {} }) {
		// If no headers are provided, use an empty object
		const headers = args.headers ?? {}

		// if Content-Type is not provided, set it to application/json
		if (!headers['Content-Type']) {
			headers['Content-Type'] = 'application/json'
		}

		const result = await this.fetch(args.url, {
			method: 'POST',
			credentials: args.credentials ?? 'omit',
			headers,
			body: JSON.stringify({
				query: text,
				variables,
			}),
		})

		// parse the result as json
		return await result.json()
	}
}
