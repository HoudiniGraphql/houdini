import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import copyRuntime from './copyRuntime'
import meta from './meta'

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query, fragment, mutation, etc.
export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	await Promise.all([
		// copy the runtime to the appropriate place
		copyRuntime(config, docs),
		// add the meta file
		meta(config),
	])
}
