// externals
import { Config } from 'houdini-common'
import { HoudiniInfoError } from '../error'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'

// noIDAlias verifies that the user did not alias any field as id which would conflict
//with the runtime's cache invalidation strategy
export default async function noIDAlias(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// collect the errors
	const errors: HoudiniInfoError[] = []

	for (const { filename, document } of docs) {
		graphql.visit(document, {
			Field: {
				enter(node) {
					// if there is an alias on the node
					if (node.alias?.value === 'id') {
						errors.push({ message: 'Encountered field with alias id in ' + filename })
					}
				},
			},
		})
	}

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}
