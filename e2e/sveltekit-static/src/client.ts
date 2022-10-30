import { HoudiniClient, type RequestHandlerArgs } from '$houdini';

async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	metadata
}: RequestHandlerArgs) {
	const url = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
	const result = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query: text,
			variables
		})
	});
	return await result.json();
}

export default new HoudiniClient(fetchQuery);
