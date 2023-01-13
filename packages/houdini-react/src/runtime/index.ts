import { getCurrentClient } from '$houdini/runtime/lib'
import type { QueryArtifact } from 'houdini'

export async function query(artifact: QueryArtifact, variables?: any) {
	const observer = getCurrentClient().observe({ artifact })

	const result = await observer.send({
		variables,
	})

	return [result]
}
