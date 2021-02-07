// externals
import { applyTransforms as apply, TransformPipeline, Config } from 'houdini-common'
import mkdirp from 'mkdirp'
import fs from 'fs/promises'
// locals
import { CollectedGraphQLDocument } from '../types'
import artifacts from './artifacts'
import mutations from './mutations'

// the default list of transforms to apply
const generatorPipeline: TransformPipeline<CollectedGraphQLDocument[]> = {
	transforms: [artifacts, mutations],
}

export default async function runGenerators(config: Config, documents: CollectedGraphQLDocument[]) {
	// delete and recreate the runtime directory
	await fs.rmdir(config.artifactDirectory, { recursive: true })
	await mkdirp(config.artifactDirectory)

	// run the generators
	return await apply(config, generatorPipeline, documents)
}
