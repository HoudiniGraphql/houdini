import * as graphql from 'graphql'

import { Config, parentTypeFromAncestors, CollectedGraphQLDocument } from '../../lib'
import { unwrapType } from '../utils'

// typename adds __typename to the selection set of any unions or interfaces
export default async function addTypename(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// visit every document
	for (const doc of documents) {
		// update the document (graphql.visit is pure)
		doc.document = graphql.visit(doc.document, {
			Field(node, key, parent, path, ancestors): graphql.ASTNode | undefined {
				// if we are looking at a leaf type
				if (!node.selectionSet) {
					return
				}

				// figure out the parent type
				const type = parentTypeFromAncestors(
					config.schema,
					doc.filename,
					ancestors.slice(0, -1)
				)
				// look up the field definition in the parent type
				const field = type.getFields()[node.name.value]

				// look up the field in the parent
				const fieldType = unwrapType(config, field.type).type
				// if we are looking at an interface
				if (graphql.isInterfaceType(fieldType) || graphql.isUnionType(fieldType)) {
					// add the __typename selection to the field's selection set
					return {
						...node,
						selectionSet: {
							...node.selectionSet,
							selections: [
								...node.selectionSet.selections,
								{
									kind: graphql.Kind.FIELD,
									name: {
										kind: graphql.Kind.NAME,
										value: '__typename',
									},
								},
							],
						},
					}
				}
			},
		})
	}
}
