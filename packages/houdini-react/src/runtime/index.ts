import { getCurrentClient } from '$houdini/runtime/lib'
import type { QueryArtifact } from 'houdini'

// this filepath will be replaced to an actual import of the client
import client from './client'

export async function query(artifact: QueryArtifact, variables?: any) {
	const observer = getCurrentClient().observe({ artifact })

	const result = await observer.send({
		variables,
	})

	return [result]
}
