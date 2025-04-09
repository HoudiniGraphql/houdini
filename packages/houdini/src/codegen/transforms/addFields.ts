import * as graphql from 'graphql'

import type { Config, Document } from '../../lib'
import { parentTypeFromAncestors, unwrapType } from '../../lib'
import { connectionSelection } from './list'
import { selectionConnectionInfo } from './paginate'

// typename adds __typename to the selection set of any unions or interfaces
export default async function addFields(config: Config, documents: Document[]): Promise<void> {
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

				// add the appropriate fields to the selection
				let newNode = addKeysToSelection(config, node, fieldType)

				// if the field is tagged with a list and is a connection we need to make sure
				// the page info is included with it
				if (
					node.directives?.find(
						(directive) =>
							directive.name.value === config.listDirective ||
							directive.name.value === config.paginateDirective
					)
				) {
					const targetFieldDefinition = type.getFields()[
						node.name.value
					] as graphql.GraphQLField<any, any>
					// we need to look if the field is a conneciton
					const { connection } = connectionSelection(
						config,
						targetFieldDefinition,
						targetFieldDefinition.type as graphql.GraphQLObjectType,
						node.selectionSet
					)
					if (connection) {
						newNode = {
							...newNode,
							selectionSet: {
								kind: graphql.Kind.SELECTION_SET,
								selections: [
									...(newNode.selectionSet?.selections || []),
									...selectionConnectionInfo,
								],
							},
						}
					}
				}

				// we're done processing the node
				return newNode
			},
			InlineFragment(node) {
				// if there is no selection, move on
				if (!node.selectionSet || !node.typeCondition) {
					return
				}

				// we know the type from the type condition
				const fragmentType = config.schema.getType(node.typeCondition.name.value)
				if (!fragmentType) {
					return
				}

				// add the appropriate fields to the selection
				return addKeysToSelection(config, node, fragmentType)
			},
			FragmentDefinition(node) {
				// we can grab the type from the definition
				const fragmentType = config.schema.getType(node.typeCondition.name.value)
				if (!fragmentType) {
					return
				}

				// add the appropriate fields to the selection
				return addKeysToSelection(config, node, fragmentType)
			},
		})
	}
}

function addKeysToSelection(
	config: Config,
	node: graphql.FieldNode | graphql.InlineFragmentNode | graphql.FragmentDefinitionNode,
	fieldType: graphql.GraphQLNamedType
) {
	// if there is no selection set, don't worry about it
	if (!node.selectionSet || node.selectionSet.selections.length == 0) {
		return node
	}

	// if the type does not have an id field ignore it
	if (!graphql.isObjectType(fieldType) && !graphql.isInterfaceType(fieldType)) {
		return node
	}

	// now we need to add the keys

	// look up the key fields for a given type
	const keyFields = config.keyFieldsForType(fieldType.name)

	// if there is no id field of the type
	if (keyFields.find((key) => !fieldType.getFields()[key])) {
		return node
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
