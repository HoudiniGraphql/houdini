import * as graphql from 'graphql'

import { Config, parentTypeFromAncestors, HoudiniError, CollectedGraphQLDocument } from '../../lib'

// noIDAlias verifies that the user did not alias any field as id which would conflict
//with the runtime's cache invalidation strategy
export default async function noIDAlias(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// collect the errors
	const errors: Error[] = []

	for (const { filename, document } of docs) {
		graphql.visit(document, {
			Field(node, _, __, ___, ancestors) {
				const fieldType = parentTypeFromAncestors(config.schema, filename, ancestors).name

				// if there is an alias on the node
				if (config.keyFieldsForType(fieldType).includes(node.alias?.value || '')) {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message: 'Encountered field with an alias that overwrites an id field',
						})
					)
				}
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
