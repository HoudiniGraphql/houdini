// externals
import { Config, getRootType } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
import { HoudiniError, HoudiniErrorTodo } from '../error'

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
			Directive: {
				enter(node, key, parent, path, ancestors) {
					// if we found a @connection applied
					if (node.name.value === 'connection') {
						// look up the name passed to the directive
						const nameArg = node.arguments?.find((arg) => arg.name.value === 'name')

						// if we need to use an error relative to this node
						let erorr = {
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
							erorr.message = '@connection must have a name argument'
							errors.push(erorr)
							return
						}

						// make sure it was a string
						if (nameArg.value.kind !== 'StringValue') {
							erorr.message = '@connection name must be a string'
							errors.push(erorr)
							return
						}

						// if we've already seen this connection
						if (connections[nameArg.value.value]) {
							erorr.message = '@connection name must be unique'
							errors.push(erorr)
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
						const parentType = getTypeFromAncestors(config.schema, [
							...parents.slice(1),
						])

						// if id is not a valid field on the parent, we won't be able to add or remove
						// from this connection if it doesn't fall under root
						if (
							!(parentType instanceof graphql.GraphQLObjectType) ||
							!parentType.getFields().id
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
			},
		})
	}

	// if we ran into any errors
	if (errors.length > 0) {
		throw errors
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
						// add a dfragment to remove from the specific connection
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

			// we need to add a delete directive for every type that is the target of a connection
			...[
				...new Set(
					Object.values(connections).map(({ type, field }) => {
						// only consider object types
						if (!(type instanceof graphql.GraphQLObjectType)) {
							return ''
						}
						// grab the type of the field marked with connection
						const fieldType = getRootType(type.getFields()[field.name.value]?.type)

						// if we're not looking at an object
						if (!(fieldType instanceof graphql.GraphQLObjectType)) {
							return ''
						}

						return fieldType.name
					})
				).values(),
			]
				.filter(Boolean)
				.flatMap<graphql.DirectiveDefinitionNode>((typeName) => {
					return [
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
					]
				}),
		],
	}
}

function getTypeFromAncestors(
	schema: graphql.GraphQLSchema,
	ancestors: (
		| graphql.OperationDefinitionNode
		| graphql.FragmentDefinitionNode
		| graphql.SelectionNode
		| graphql.SelectionSetNode
	)[]
): graphql.GraphQLNamedType {
	// get the front node
	let head = ancestors.shift()
	// if it was a list, skip it
	if (Array.isArray(head)) {
		return getTypeFromAncestors(schema, ancestors)
	}

	if (!head) {
		throw new Error('Could not figure out type of field where directive is applied')
	}

	// if we are at the top of the definition stack
	if (head.kind === 'OperationDefinition') {
		// grab the appropriate
		const operationType = {
			query: schema.getQueryType(),
			mutation: schema.getMutationType(),
			subscription: schema.getSubscriptionType(),
		}[head.operation]

		if (!operationType) {
			throw new Error('Could not find operation type')
		}
		return operationType
	}

	if (head.kind === 'FragmentDefinition') {
		// look up the type condition in the schema
		const result = schema.getType(head.typeCondition.name.value)
		if (!result) {
			throw new Error(
				`Could not find definition for ${head.typeCondition.name} in the schema`
			)
		}

		// we're done here
		return result
	}

	// if we are looking at a fragment spread there is a serious problem
	if (head.kind === 'FragmentSpread') {
		throw new Error('How the hell did this happen?')
	}

	// grab our parent type
	const parent = getTypeFromAncestors(schema, ancestors)

	// if the parent type is not an object type, we have a problem
	if (!(parent instanceof graphql.GraphQLObjectType)) {
		throw new Error('parent type was not an object')
	}

	// we are looking at an inline fragment or selection select
	if (head.kind === 'InlineFragment' || head.kind === 'SelectionSet') {
		// our type is our parent's type
		return parent
	}

	// we are looking at a field so we can just access the field map of the parent type
	const field = parent.getFields()[head.name.value]
	if (!field) {
		throw new Error(`Could not find definition of ${head.name.value} in ${parent.toString()}`)
	}

	return getRootType(field.type) as graphql.GraphQLNamedType
}
