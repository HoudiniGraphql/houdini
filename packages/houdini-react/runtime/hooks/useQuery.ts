import type { GraphQLObject, QueryArtifact } from 'houdini/runtime.js'

import type { UseQueryConfig } from './useQueryHandle.js'
import { useQueryHandle } from './useQueryHandle.js'

export function useQuery<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
>(document: { artifact: _Artifact }, variables: any = null, config: UseQueryConfig = {}): _Data {
	const { data } = useQueryHandle<_Artifact, _Data>(document, variables, config)
	return data as unknown as _Data
}
