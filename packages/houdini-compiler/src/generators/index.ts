// externals
import { applyTransforms as apply, TransformPipeline, Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// the default list of transforms to apply
const generatorPipeline: TransformPipeline<CollectedGraphQLDocument[]> = {
	transforms: [],
}

export default function runGenerators(config: Config, documents: CollectedGraphQLDocument[]) {
	return apply(config, generatorPipeline, documents)
}
