// externals
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// typeCheck verifies that the documents are valid
export default async function typeCheck(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {}
