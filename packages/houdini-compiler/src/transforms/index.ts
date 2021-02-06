// externals
import { applyTransforms as apply, TransformPipeline, Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'
import includeFragmentDefinitions from './includeFragmentDefinitions'

// the default list of transforms to apply
const transformPipeline: TransformPipeline<CollectedGraphQLDocument[]> = {
	transforms: [includeFragmentDefinitions],
}

export default function applyTransforms(config: Config, documents: CollectedGraphQLDocument[]) {
	return apply(config, transformPipeline, documents)
}
