import * as graphql from 'graphql'

import { ArtifactKind, Config, deepMerge, Document } from '../../lib'
import { parentTypeFromAncestors, unwrapType } from '../../lib'

// We need to add some fields to every document in order to streamline operations.
// In order to avoid confusing the masking logic, we are going to add a fragment
// to the root of the document that adds the necssary selections to the matching objects
export default async function addID(config: Config, documents: Document[]): Promise<void> {
	// build up the list of definitions
	const definitions: graphql.FragmentDefinitionNode[] = []

	// visit every document
	for (const doc of documents) {
		for (const definition of doc.document.definitions) {
			// figure out the root of the fragment definition
			let rootType: string | undefined = ''
			let name = doc.name
			if (definition.kind === 'FragmentDefinition') {
				rootType = definition.typeCondition.name.value
				name = definition.name.value
			} else if (definition.kind === 'OperationDefinition') {
				if (definition.operation === 'query') {
					rootType = config.schema.getQueryType()?.name
				} else if (definition.operation === 'mutation') {
					rootType = config.schema.getMutationType()?.name
				} else if (definition.operation === 'subscription') {
					rootType = config.schema.getSubscriptionType()?.name
				}
			}

			// not all definitions that we run into are useful. directive definitions
			// need to be ignored
			if (
				!rootType ||
				(definition.kind !== 'FragmentDefinition' &&
					definition.kind !== 'OperationDefinition') ||
				!definition.selectionSet
			) {
				continue
			}

			// build up a fragment definition that has every field
			const fragmentDefinition: graphql.FragmentDefinitionNode = {
				kind: 'FragmentDefinition',
				name: {
					kind: 'Name',
					value: `${name}__houdini__extra__fields`,
				},
				typeCondition: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: rootType,
					},
				},
				selectionSet: definition.selectionSet,
			}

			// in order for our utilities to work we need to wrap the definition in a document
			const newSelection = addFields(config, doc, {
				kind: graphql.Kind.DOCUMENT,
				definitions: [fragmentDefinition],
			}).definitions[0]!.selectionSet

			// @ts-expect-error: its read only
			// add the selection to the definition
			fragmentDefinition.selectionSet = {
				kind: 'SelectionSet',
				selections: newSelection.selections.concat({
					kind: 'Field',
					name: {
						kind: 'Name',
						value: '__typename',
					},
				}),
			}

			// if there are selections to add, then do it
			if (fragmentDefinition.selectionSet.selections.length > 0) {
				definition.selectionSet.selections = definition.selectionSet.selections.concat([
					{
						kind: 'FragmentSpread',
						name: {
							kind: 'Name',
							value: fragmentDefinition.name.value,
						},
					},
				])

				// add the definition to the list
				definitions.push(fragmentDefinition)
			}
		}
	}
	const docWithDefs: graphql.DocumentNode = {
		kind: graphql.Kind.DOCUMENT,
		definitions,
	}

	// add a document to the pile that contains the fragment definition
	documents.push({
		name: 'generated::extraFields',
		kind: ArtifactKind.Fragment,
		document: docWithDefs,
		originalParsed: docWithDefs,
		generateStore: false,
		generateArtifact: false,
		filename: 'generated::extraFields',
		originalString: graphql.print(docWithDefs),
		artifact: null,
	})
}

function addFields(config: Config, doc: Document, document: graphql.DocumentNode) {
	return graphql.visit(document, {
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

			let newNode: graphql.FieldNode | graphql.InlineFragmentNode | undefined
			// if we are looking at an interface
			if (graphql.isInterfaceType(fieldType) || graphql.isUnionType(fieldType)) {
				// add the __typename selection to the field's selection set
				newNode = {
					kind: 'Field',
					name: {
						kind: 'Name',
						value: node.name.value,
					},
					selectionSet: {
						kind: 'SelectionSet',
						selections: [
							...(newNode?.selectionSet?.selections ?? []),
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

			// add the appropriate fields to the selection
			const withKeys = addKeysToSelection(config, node, fieldType)
			if (withKeys) {
				newNode = withKeys
			}

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
		FragmentDefinition: {
			leave(node) {
				// we know the type from the type condition
				const fragmentType = config.schema.getType(node.typeCondition.name.value)
				if (!fragmentType) {
					return
				}

				// add the appropriate fields to the selection
				return addKeysToSelection(config, node, fragmentType)
			},
		},
	})
}

function addKeysToSelection<
	T extends graphql.FieldNode | graphql.InlineFragmentNode | graphql.FragmentDefinitionNode
>(config: Config, node: T, fieldType: graphql.GraphQLNamedType): T | undefined {
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
	const selections = [...node.selectionSet!.selections].filter(
		(selection) =>
			selection.kind !== 'FragmentSpread' &&
			(selection.kind !== 'Field' || selection.selectionSet)
	)

	// add __typename to the list of keys
	keyFields.push('__typename')

	for (const keyField of keyFields) {
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
			...node.selectionSet!,
			selections,
		},
	}
}
