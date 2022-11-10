import { fetchQuery } from '$houdini/runtime/lib'
import type { QueryArtifact } from 'houdini'

// this filepath will be replaced to an actual import of the client
import client from './client'

export async function query(artifact: QueryArtifact, variables?: any) {
	const result = await fetchQuery({
		client,
		artifact,
		variables,
		context: {
			fetch,
			session: {},
			metadata: {},
		},
		setFetching: () => {
			console.log('fetching...')
		},
	})

	return [result.result]
}
