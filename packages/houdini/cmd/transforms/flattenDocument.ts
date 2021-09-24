import { Config } from 'houdini-common'
import { CollectedGraphQLDocument } from '..'

// includeFragmentDefinitions adds any referenced fragments to operations
export default async function flattenDocument(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {}
