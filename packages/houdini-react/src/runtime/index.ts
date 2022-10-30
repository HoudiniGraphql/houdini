import type { QueryArtifact } from 'houdini'

export function useQuery(query: QueryArtifact, variables?: any) {
	return [{ result: 'foo' }]
}
