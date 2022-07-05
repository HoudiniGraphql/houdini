// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import copyRuntime from './copyRuntime'
import writeIndexFile from './indexFile'
import meta from './meta'

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc. They are generated here instead of
// imported from npm so that they can be pushed through the bundler in order to use package aliases
// and things like sapper's internal @sapper/app or sveltekit's $app/navigation
export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	await Promise.all([
		// copy the runtime to the appropriate place
		copyRuntime(config, docs),
		// and the index file at the root of the runtime
		writeIndexFile(config, docs),
		// add the meta file
		meta(config),
	])
}
