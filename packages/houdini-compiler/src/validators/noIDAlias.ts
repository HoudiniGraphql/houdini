// external imports
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// noIDAlias prevents the user from aliasing another field as id so cache invalidation works
export default async function noIDAlias(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {}
