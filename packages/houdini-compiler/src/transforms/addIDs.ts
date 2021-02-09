// externals
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// addIDs adds the id field to any objects that support it for full cache support
export default async function addIDs(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {}
