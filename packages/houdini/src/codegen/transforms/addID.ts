import * as graphql from 'graphql'

import { Config, parentTypeFromAncestors, CollectedGraphQLDocument } from '../../lib'
import { unwrapType } from '../utils'

// typename adds __typename to the selection set of any unions or interfaces
export default async function addID(
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

				// if there is no selection set, don't worry about it
				if (node.selectionSet?.selections.length > 0) {
					// if the type does not have an id field ignore it
					if (!graphql.isObjectType(fieldType) && !graphql.isInterfaceType(fieldType)) {
						return
					}

					// look up the key fields for a given type
					const keyFields = config.keyFieldsForType(fieldType.name)

					// if there is no id field of the type
					if (keyFields.find((key) => !fieldType.getFields()[key])) {
						return
					}

					// add the id fields for the given type
					const selections = [...node.selectionSet.selections]

					for (const keyField of keyFields) {
						// if there is already a selection for id, ignore it
						if (
							node.selectionSet.selections.find(
								(selection) =>
									selection.kind === 'Field' &&
									!selection.alias &&
									selection.name.value === keyField
							)
						) {
							continue
						}

						// add a selection for the field to the selection set
						selections.push({
							kind: graphql.Kind.FIELD,
							name: {
								kind: graphql.Kind.NAME,
								value: keyField,
							},
						})
					}

					// add the __typename selection to the field's selection set
					return {
						...node,
						selectionSet: {
							...node.selectionSet,
							selections,
						},
					}
				}
			},
		})
	}
}
