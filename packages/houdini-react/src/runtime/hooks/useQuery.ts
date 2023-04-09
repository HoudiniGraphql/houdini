import type { GraphQLObject, QueryArtifact } from '$houdini/runtime/lib/types'

import type { UseQueryConfig } from './useQueryHandle'
import { useQueryHandle } from './useQueryHandle'

export function useQuery<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
>(
	document: { artifact: QueryArtifact },
	variables: any = null,
	config: UseQueryConfig = {}
): _Data {
	const { data } = useQueryHandle<_Artifact, _Data, _Input>(document, variables, config)
	return data
}
