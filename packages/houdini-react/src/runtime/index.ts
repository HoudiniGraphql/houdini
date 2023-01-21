import { HoudiniClient } from '$houdini/runtime/client'
import type { QueryArtifact } from 'houdini'

const client = new HoudiniClient({
	url: 'http://localhost:4000/graphql',
})

export async function query(artifact: QueryArtifact, variables?: any) {
	const observer = client.observe({ artifact })

	const result = await observer.send({
		variables,
	})

	return [result]
}
