// externals
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../../types'

// the runtime generator is responsible for generating a majority of the runtime that the client will use.
// this includes things like query(), fragment(), mutation(), etc. They are generated here instead of 
// imported at runtime so that they can be pushed through the bundler and refer to packages aliases
// and sapper's internal @sapper/app

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
}