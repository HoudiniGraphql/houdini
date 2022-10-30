import type { QueryArtifact } from 'houdini'

export async function query(artifact: QueryArtifact, variables?: any) {
	return [{ result: artifact.name }]
}
