// externals
import { Config, getTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'

// typename adds __typename__ to the selection set of any unions or interfaces
export default async function addConnectionFragments(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// visit every document
	for (const { document } of documents) {
		graphql.visit(document, {
			Field(node, key, parent, path, ancestors) {
				const type = getTypeFromAncestors(config.schema, ancestors)
			},
		})
	}
}
