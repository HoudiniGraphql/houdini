// externals
import { applyTransforms as apply, TransformPipeline, Config } from 'houdini-common'
import mkdirp from 'mkdirp'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument } from '../types'
import artifacts from './artifacts'
import interactions from './interactions'

// the default list of transforms to apply
const generatorPipeline: TransformPipeline<CollectedGraphQLDocument[]> = {
	transforms: [artifacts, interactions],
}

export default async function runGenerators(config: Config, documents: CollectedGraphQLDocument[]) {
	// delete and recreate the runtime directory
	// await fs.rmdir(config.runtimeDirectory, { recursive: true })
	await Promise.all([mkdirp(config.interactionDirectory), mkdirp(config.artifactDirectory)])

	// run the generators
	return await apply(config, generatorPipeline, documents)
}
