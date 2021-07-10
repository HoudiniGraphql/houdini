// externals
import * as graphql from 'graphql'
import { Config, parentTypeFromAncestors } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// paginate transform adds the necessary fields for a paginated field
export default async function paginate(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// visit every document
	for (const doc of documents) {
		// remember if we ran into a paginate argument
		let paginated = false
		// track the kind pagination
		let cursorPagination = false
		let forwardPagination = false
		let backwardsPagination = false
		let offsetPagination = false

		let first: number = 0
		let after: string = ''

		let last: number = 0
		let before: string = ''

		let limit: number = 0
		let offset: number = 0

		// we need to add page info to the selection
		doc.document = graphql.visit(doc.document, {
			Field(node, _, parent, ___, ancestors) {
				// if there's no paginate directive, ignore the field
				const paginateDirective = node.directives?.find(
					(directive) => directive.name.value === config.paginateDirective
				)
				if (!paginateDirective) {
					return
				}

				// remember we saw this directive
				paginated = true

				// look for the parent type
				const parentType = parentTypeFromAncestors(
					config.schema,
					ancestors
				) as graphql.GraphQLObjectType

				const { args: fieldArgs } = parentType.getFields()[node.name.value]

				forwardPagination =
					fieldArgs.filter((arg) => arg.name === 'first' || arg.name === 'after')
						.length === 2
				backwardsPagination =
					fieldArgs.filter((arg) => arg.name === 'last' || arg.name === 'before')
						.length === 2
				cursorPagination = forwardPagination || backwardsPagination

				// while we're here see if we support offset
				offsetPagination =
					fieldArgs.filter((arg) => arg.name === 'offset' || arg.name === 'limit')
						.length === 2

				// we need to replace the hard coded first and last arguments with variables
				let nodeArguments = [...(node.arguments || [])].map((argument, i) => {
					// if we found the first argument
					if (argument.name.value === 'first') {
						// disable backwards pagination
						backwardsPagination = false

						// store the value so we can set a default
						first = parseInt((argument.value as graphql.IntValueNode).value)

						// turn the field into a variable
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'first',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'first',
								},
							},
						}
					}
					// process and hoist the last argument
					else if (argument.name.value === 'last') {
						// disable forward pagination
						forwardPagination = false

						// store the value so we can set a default
						last = parseInt((argument.value as graphql.IntValueNode).value)

						// add the variable in its place
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'last',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'last',
								},
							},
						}
					}
					// process and hoist the limit arg
					else if (argument.name.value === 'limit') {
						// disable both pagination flags
						forwardPagination = false
						backwardsPagination = false

						// store the value so we can set a default
						limit = parseInt((argument.value as graphql.IntValueNode).value)

						// add the variable in its place
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'limit',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'limit',
								},
							},
						}
					}
					// process and hoist the before arg
					else if (argument.name.value === 'before') {
						// store the value so we can set a default
						before = (argument.value as graphql.StringValueNode).value

						// add the variable in its place
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'before',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'before',
								},
							},
						}
					}
					// process and hoist the after arg
					else if (argument.name.value === 'after') {
						// store the value so we can set a default
						after = (argument.value as graphql.StringValueNode).value

						// add the variable in its place
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'after',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'after',
								},
							},
						}
					}
					// process and hoist the offset arg
					else if (argument.name.value === 'offset') {
						// store the value so we can set a default
						offset = parseInt((argument.value as graphql.IntValueNode).value)

						// add the variable in its place
						return {
							kind: 'Argument',
							name: {
								kind: 'Name',
								value: 'offset',
							},
							value: {
								kind: 'Variable',
								name: {
									kind: 'Name',
									value: 'offset',
								},
							},
						}
					}
				})

				// if the field supports cursor based pagination we need to make sure we have the
				// page info field
				if (!cursorPagination) {
					return {
						...node,
						arguments: nodeArguments,
					}
				}

				// if there's no selection set ignore the field
				if (!node.selectionSet) {
					return
				}

				return {
					...node,
					arguments: nodeArguments,
					selectionSet: {
						...node.selectionSet,
						selections: [
							...node.selectionSet.selections,
							{
								kind: 'Field',
								name: {
									kind: 'Name',
									value: 'edges',
								},
								selectionSet: {
									kind: 'SelectionSet',
									selections: [
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'cursor',
											},
										},
									],
								},
							},
							{
								kind: 'Field',
								name: {
									kind: 'Name',
									value: 'pageInfo',
								},
								selectionSet: {
									kind: 'SelectionSet',
									selections: [
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'hasPreviousPage',
											},
										},
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'hasNextPage',
											},
										},
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'startCursor',
											},
										},
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'endCursor',
											},
										},
									],
								},
							},
						],
					},
				} as graphql.FieldNode
			},
		})

		// if we saw the paginate directive we need to add arguments to the fragment
		if (paginated) {
			// add the arguments directive if it doesn't exist
			doc.document = graphql.visit(doc.document, {
				FragmentDefinition(node) {
					// look at the fragment definition for an arguments directive
					const argDirective = node.directives?.find(
						(directive) => directive.name.value === config.argumentsDirective
					)

					// if there isn't an arguments directive, add it and we'll add arguments to it when we run into it
					if (!argDirective) {
						// add it
						return {
							...node,
							directives: [
								...(node.directives || []),
								{
									kind: 'Directive',
									name: {
										kind: 'Name',
										value: config.argumentsDirective,
									},
								},
							] as graphql.DirectiveNode[],
						}
					}
				},
				Directive(node) {
					// if we are not looking at the arguments directive, ignore it
					if (node.name.value !== config.argumentsDirective) {
						return
					}

					// figure out the args to add
					let newArgs = []

					// if the field supports offset pagination
					if (offsetPagination) {
						newArgs = argumentsList({
							offset: ['Int', offset],
							limit: ['Int', limit],
						})
					}
					// the field supports cursor based pagination
					else {
						// if the field supports forward pagination
						if (forwardPagination) {
							newArgs.push(
								...argumentsList({
									first: ['Int', first],
									after: ['String', after],
								})
							)
						}

						// the field could also support backwards pagination
						if (backwardsPagination) {
							newArgs.push(
								...argumentsList({
									last: ['Int', last],
									before: ['String', before],
								})
							)
						}
					}

					// add non-null versions of the arguments we'll use to paginate
					return {
						...node,
						arguments: [...(node.arguments || []), ...newArgs],
					} as graphql.DirectiveNode
				},
			})
		}
	}
}

function argumentsList(
	source: Record<string, [string, number | string | undefined]>
): graphql.ArgumentNode[] {
	return Object.entries(source).map(([name, value]) => ({
		kind: 'Argument',
		name: {
			kind: 'Name',
			value: name,
		},
		value: objectNode(value),
	}))
}

function objectNode([type, defaultValue]: [
	string,
	number | string | undefined
]): graphql.ObjectValueNode {
	const node = {
		kind: 'ObjectValue' as 'ObjectValue',
		fields: [
			{
				kind: 'ObjectField',
				name: {
					kind: 'Name',
					value: 'type',
				},
				value: {
					kind: 'StringValue',
					value: type,
				},
			},
		] as graphql.ObjectFieldNode[],
	}

	// if there's a default value, add it
	if (defaultValue) {
		node.fields.push({
			kind: 'ObjectField',
			name: { kind: 'Name', value: 'default' } as graphql.NameNode,
			value: {
				kind: typeof defaultValue === 'number' ? 'IntValue' : 'StringValue',
				value: defaultValue.toString(),
			},
		} as graphql.ObjectFieldNode)
	}

	return node
}
