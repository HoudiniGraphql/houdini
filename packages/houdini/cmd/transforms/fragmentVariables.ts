// externals
import { Config } from 'houdini-common'
import graphql, { Kind as GraphqlKinds } from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'

// fragmentVariables transforms fragment spreads with variables into something the server can use
export default async function fragmentVariables(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// since generated fragments might need to reference variables defined in an operation,
	// we need to only consider operation documents and then walk down, adding any new fragments
	// to the list and replacing the fragment spread with a reference to the new fragment
	for (const { document } of documents) {
		// look for the operation in this document
		const operation = document.definitions.find(
			({ kind }) => kind === GraphqlKinds.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode

		// if there isn't one we don't care about this document
		if (!operation) {
			continue
		}
	}
}

function hashInput() {
	return ''
}
