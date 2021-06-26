// externals
import { Config, getTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument, HoudiniError, HoudiniErrorTodo } from '../types'

// addConnectionFragments adds fragments for the fields tagged with @connection
export default async function addConnectionFragments(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// collect all of the fields that have the connection applied
	const connections: {
		[name: string]: {
			field: graphql.FieldNode
			type: graphql.GraphQLNamedType
			filename: string
		}
	} = {}

	const errors: HoudiniError[] = []

	// look at every document
	for (const { document, filename, printed } of documents) {
		graphql.visit(document, {
			Directive(node, key, parent, path, ancestors) {
				// if we found a @connection applied
				if (node.name.value === 'connection') {
					// look up the name passed to the directive
					const nameArg = node.arguments?.find((arg) => arg.name.value === 'name')

					// if we need to use an error relative to this node
					let error = {
						...new graphql.GraphQLError(
							'',
							node,
							new graphql.Source(printed),
							node.loc ? [node.loc.start, node.loc.end] : null,
							path
						),
						filepath: filename,
					}

					// if there is no name argument
					if (!nameArg) {
						error.message = '@connection must have a name argument'
						errors.push(error)
						return
					}

					// make sure it was a string
					if (nameArg.value.kind !== 'StringValue') {
						error.message = '@connection name must be a string'
						errors.push(error)
						return
					}

					// if we've already seen this connection
					if (connections[nameArg.value.value]) {
						error.message = '@connection name must be unique'
						errors.push(error)
					}

					// we need to traverse the ancestors from child up
					const parents = [...ancestors] as (
						| graphql.OperationDefinitionNode
						| graphql.FragmentDefinitionNode
						| graphql.SelectionNode
					)[]
					parents.reverse()

					const type = getTypeFromAncestors(config.schema, [...parents])

					// look up the parent's type
					const parentType = getTypeFromAncestors(config.schema, [...parents.slice(1)])

					// if id is not a valid field on the parent, we won't be able to add or remove
					// from this connection if it doesn't fall under root
					if (
						!(parentType instanceof graphql.GraphQLObjectType) ||
						(parentType.name !== config.schema.getQueryType()?.name &&
							!parentType.getFields().id)
					) {
						throw {
							...new graphql.GraphQLError(
								'Can only use a connection field on fragment on a type with id'
							),
							filepath: filename,
						}
					}

					// add the target of the directive to the list
					connections[nameArg.value.value] = {
						field: ancestors[ancestors.length - 1] as graphql.FieldNode,
						type,
						filename,
					}
				}
			},
		})
	}

	// if we ran into any errors
	if (errors.length > 0) {
		throw errors
	}

	// we need to add a delete directive for every type that is the target of a connection
	const connectionTargets = [
		...new Set(
			Object.values(connections).map(({ type, field }) => {
				// only consider object types
				if (!(type instanceof graphql.GraphQLObjectType)) {
					return ''
				}

				return type.name
			})
		).values(),
	].filter(Boolean)

	// if there are no documents, we don't have anything to do
	if (documents.length === 0) {
		return
	}

	// we need to add the fragment definitions __somewhere__ where they will be picked up
	// so we're going to add them to the list of documents, one each
	documents[0].document = {
		...documents[0].document,
		definitions: [
			...documents[0].document.definitions,
			// every connection needs insert and remove fragments
			...Object.entries(connections).flatMap<graphql.FragmentDefinitionNode>(
				([name, { field, type, filename }]) => {
					// look up the type
					const schemaType = config.schema.getType(type.name) as graphql.GraphQLObjectType

					// if there is no selection set
					if (!field.selectionSet) {
						throw new HoudiniErrorTodo('Connections must have a selection')
					}

					// we need a copy of the field's selection set that we can mutate
					const selection: graphql.SelectionSetNode = {
						kind: 'SelectionSet',
						selections: [...field.selectionSet.selections],
						loc: field.selectionSet.loc,
					}

					// is there no id selection
					if (
						schemaType &&
						selection &&
						!selection?.selections.find(
							(selection) =>
								selection.kind === 'Field' && selection.name.value === 'id'
						)
					) {
						// add the id field to the selection
						selection.selections = [
							...selection.selections,
							{
								kind: 'Field',
								name: {
									kind: 'Name',
									value: 'id',
								},
							},
						]
					}

					// we at least want to create fragment to indicate inserts in connections
					return [
						// a fragment to insert items into this connection
						{
							kind: graphql.Kind.FRAGMENT_DEFINITION,
							// in order to insert an item into this connection, it must
							// have the same selection as the field
							selectionSet: selection,
							name: {
								kind: 'Name',
								value: config.connectionInsertFragment(name),
							},
							typeCondition: {
								kind: 'NamedType',
								name: {
									kind: 'Name',
									value: type.name,
								},
							},
						},
						// add a fragment to remove from the specific connection
						{
							kind: graphql.Kind.FRAGMENT_DEFINITION,
							name: {
								kind: 'Name',
								value: config.connectionRemoveFragment(name),
							},
							// deleting an entity just takes its id and the parent
							selectionSet: {
								kind: 'SelectionSet',
								selections: [
									{
										kind: 'Field',
										name: {
											kind: 'Name',
											value: 'id',
										},
									},
								],
							},
							typeCondition: {
								kind: 'NamedType',
								name: {
									kind: 'Name',
									value: type.name,
								},
							},
						},
					]
				}
			),

			...connectionTargets.flatMap<graphql.DirectiveDefinitionNode>((typeName) => [
				{
					kind: 'DirectiveDefinition',
					name: {
						kind: 'Name',
						value: config.connectionDeleteDirective(typeName),
					},
					locations: [
						// the delete directive must be applied to a field in the response
						// corresponding to the id
						{
							kind: 'Name',
							value: 'FIELD',
						},
					],
					repeatable: true,
				},
			]),
		],
	}
}
