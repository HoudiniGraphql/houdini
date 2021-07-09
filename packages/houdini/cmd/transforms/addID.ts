// externals
import { Config, parentTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
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
				const type = parentTypeFromAncestors(config.schema, ancestors.slice(0, -1))
				// look up the field definition in the parent type
				const field = type.getFields()[node.name.value]

				// look up the field in the parent
				const fieldType = unwrapType(config, field.type).type

				// if there is no selection set, dont worry about it
				if (node.selectionSet?.selections.length > 0) {
					// if the type does not have an id field ignore it
					if (!graphql.isObjectType(fieldType) && !graphql.isInterfaceType(fieldType)) {
						return
					}

					// if there is no id field of the type
					if (!fieldType.getFields()['id']) {
						return
					}

					// if there is already a selection for id
					if (
						node.selectionSet.selections.find(
							(selection) =>
								selection.kind === 'Field' &&
								selection.alias === null &&
								selection.name.value === 'id'
						)
					) {
						return
					}

					// add the __typename selection to the field's selection set
					return {
						...node,
						selectionSet: {
							...node.selectionSet,
							selections: [
								...node.selectionSet.selections,
								{
									kind: 'Field',
									name: {
										kind: 'Name',
										value: 'id',
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
