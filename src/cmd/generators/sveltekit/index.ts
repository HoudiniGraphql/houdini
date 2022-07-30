import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { glob } from 'glob'
import { promisify } from 'util'

export default async function sveltekitGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// we will only generate things if the project is using svelte kit
	if (config.framework !== 'kit') {
		return
	}

	// we need to look at every filepath and generate loads for the routes
	const sourceFiles = await promisify(glob)(config.sourceGlob)

	console.log(sourceFiles)
}
