import { type QueryArtifact, GraphQLObject } from '$houdini/runtime/lib/types'

import { useQueryHandle } from './useQueryHandle'

export function useQuery<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
>(args: Parameters<typeof useQueryHandle>[0]): _Data {
	const [data] = useQueryHandle<_Artifact, _Data, _Input>(args)
	return data
}
