import { type QueryArtifact, GraphQLObject } from '$houdini/runtime/lib/types'

import { UseQueryConfig, useQueryHandle } from './useQueryHandle'

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
