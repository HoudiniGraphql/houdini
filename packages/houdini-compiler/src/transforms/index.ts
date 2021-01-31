// locals
import { CollectedGraphQLDocument } from '../types'
import apply, { TransformPipelineNode } from './apply'
import includeFragmentDefinitions from './includeFragmentDefinitions'

// the default list of transforms to apply
const transformPipeline: TransformPipelineNode = {
	transforms: [includeFragmentDefinitions],
}

export function applyTransforms(documents: CollectedGraphQLDocument[]) {
	return apply(documents, transformPipeline)
}
