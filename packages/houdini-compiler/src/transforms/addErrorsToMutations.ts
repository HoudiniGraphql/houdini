// externals
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// addErrorsToMutations automatically adds the error field to a mutation that supports it
export default async function addErrorsToMutations(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {}
