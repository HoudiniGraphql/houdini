// externals
import { Config, getRootType } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument } from '../types'
import { HoudiniError } from '../error'

// graphqlExtensions adds a few different things to the graphql schema
export default async function graphqlExtensions(
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
						const parents = [...ancestors]
						parents.reverse()

						const type = getTypeFromAncestors(
							config.schema,
							parents as (
								| graphql.OperationDefinitionNode
								| graphql.FragmentDefinitionNode
								| graphql.SelectionNode
							)[]
						)

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
			...Object.entries(connections).map(([name, { field, type, filename }]) => {
				// look up the type
				const schemaType = config.schema.getType(type.name) as graphql.GraphQLObjectType

				// is there no id selection
				if (
					schemaType &&
					field.selectionSet &&
					!field.selectionSet?.selections.find(
						(selection) => selection.kind === 'Field' && selection.name.value === 'id'
					)
				) {
					// if id is not a valid field
					if (!schemaType.getFields().id) {
						throw {
							...new graphql.GraphQLError(
								'Can only use a connection field on fragment on a type with id'
							),
							filepath: filename,
						}
					}

					field.selectionSet.selections = [
						...field.selectionSet.selections,
						{
							kind: 'Field',
							name: {
								kind: 'Name',
								value: 'id',
							},
						},
					]
				}

				return {
					kind: graphql.Kind.FRAGMENT_DEFINITION,
					selectionSet: field.selectionSet,
					name: {
						kind: 'Name',
						value: `${name}_Connection`,
					},
					typeCondition: {
						kind: 'NamedType',
						name: {
							kind: 'Name',
							value: type.name,
						},
					},
				} as graphql.FragmentDefinitionNode
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
