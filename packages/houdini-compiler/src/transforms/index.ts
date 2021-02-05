// locals
import { CollectedGraphQLDocument, TransformPipeline } from '../types'
import { applyTransforms as apply } from './apply'
import includeFragmentDefinitions from './includeFragmentDefinitions'

// the default list of transforms to apply
const transformPipeline: TransformPipeline<CollectedGraphQLDocument[]> = {
	transforms: [includeFragmentDefinitions],
}

export default function applyTransforms(documents: CollectedGraphQLDocument[]) {
	return apply(transformPipeline, documents)
}

// other packages might want the transform utilities
export * from './apply'
