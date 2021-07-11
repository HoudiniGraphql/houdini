// externals
import * as graphql from 'graphql'
import { Config, parentTypeFromAncestors } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'

// the paginate transform is responsible for preparing a fragment marked for pagination
// to be embedded in the query that will be used to fetch additional data. That means it
// is responsible for adding additional arguments to the paginated field and hoisting
// all of the pagination args to arguments of the fragment itself. It then generates
// a query that threads query variables to the updated fragment and lets the fragment
// argument transform do the rest. This whole process happens in a few steps:

// - walk through the document and look for a field marked for pagination. if one is found,
//   add the necessary arguments to the field, referencing variables that will be injected
// - if the @paginate directive was found, add the @arguments directive to the fragment
//   definition and use any fields that were previously set as the default value. that
//   will cause the fragment arguments directive to inline the default values if one isn't
//   given, preserving the original definition for the first query
// - generate the query with the fragment embedded using @with to pass query variables through

// paginate transform adds the necessary fields for a paginated field
export default async function paginate(
	config: Config,
	documents: CollectedGraphQLDocument[]
): Promise<void> {
	// we're going to have to add documents to the list so collect them here and we'll add them when we're done
	const newDocs: CollectedGraphQLDocument[] = []

	// visit every document
	for (const doc of documents) {
		// remember if we ran into a paginate argument
		let paginated = false

		// track the kind pagination
		let forwardPagination = false
		let backwardsPagination = false
		let offsetPagination = false

		let existingPaginationArgs: { [key: string]: any } = {}

		let paginationArgs: { type: string; name: string }[] = []

		// we need to add page info to the selection
		doc.document = graphql.visit(doc.document, {
			Field(node, _, __, ___, ancestors) {
				// if there's no paginate directive, ignore the field
				const paginateDirective = node.directives?.find(
					(directive) => directive.name.value === config.paginateDirective
				)
				if (!paginateDirective || !node.selectionSet) {
					return
				}

				// remember we saw this directive
				paginated = true

				// loop over the args of the field once so we can check their existence
				const args = new Set(
					(parentTypeFromAncestors(config.schema, ancestors) as
						| graphql.GraphQLObjectType
						| graphql.GraphQLInterfaceType)
						.getFields()
						[node.name.value].args.map((arg) => arg.name)
				)

				// also look to see if the user wants to do forward pagination
				const passedArgs = new Set(node.arguments?.map((arg) => arg.name.value))
				const specifiedForwards = passedArgs.has('first')
				const specifiedBackwards = passedArgs.has('last')

				// figure out what kind of pagination we support
				forwardPagination = !specifiedBackwards && args.has('first') && args.has('after')
				backwardsPagination = !specifiedForwards && args.has('last') && args.has('before')
				offsetPagination =
					!forwardPagination &&
					!backwardsPagination &&
					args.has('offset') &&
					args.has('limit')

				let {
					arguments: nodeArguments,
					values,
					paginationArguments,
				} = replaceArgumentsWithVariables(node.arguments, {
					first: {
						enabled: forwardPagination,
						type: 'Int',
					},
					after: {
						enabled: forwardPagination,
						type: 'String',
					},
					last: {
						enabled: backwardsPagination,
						type: 'Int',
					},
					before: {
						enabled: backwardsPagination,
						type: 'String',
					},
					limit: {
						enabled: offsetPagination,
						type: 'Int',
					},
					offset: {
						enabled: offsetPagination,
						type: 'Int',
					},
				})

				// extract the values we care about so the fragment argument definition
				// can use them for default values
				existingPaginationArgs = values
				paginationArgs = paginationArguments

				// if the field supports cursor based pagination we need to make sure we have the
				// page info field
				return {
					...node,
					arguments: nodeArguments,
					selectionSet: offsetPagination
						? // no need to add any fields to the selection if we're dealing with offset pagination
						  node.selectionSet
						: // add the page info if we are dealing with cursor-based pagination
						  {
								...node.selectionSet,
								selections: [...node.selectionSet.selections, ...pageInfoSelection],
						  },
				}
			},
		})

		// if we saw the paginate directive we need to add arguments to the fragment
		if (paginated) {
			let fragmentName = ''
			// check if we have to embed the fragment in Node
			let nodeQuery = false

			// remember if we found a fragment or operation
			let fragment = false

			doc.document = graphql.visit(doc.document, {
				// if we are dealing with a query, we'll need to add the variables to the definition
				OperationDefinition(node) {
					// make sure its a query
					if (node.operation !== 'query') {
						throw new Error(
							`@${config.paginateDirective} can only show up in a query or fragment document`
						)
					}

					// build a map from existing variables to their value so we can compare with the ones we need to inject
					const operationVariables: Record<string, graphql.VariableDefinitionNode> =
						node.variableDefinitions?.reduce(
							(vars, definition) => ({
								...vars,
								[definition.variable.name.value]: definition,
							}),
							{}
						) || {}

					// figure out the variables we want on the query
					let newVariables: Record<string, graphql.VariableDefinitionNode> = {}

					// add the query variables for offset pagination
					if (offsetPagination) {
						newVariables['limit'] = staticVariableDefinition(
							'limit',
							'Int',
							existingPaginationArgs['limit']
						)
						newVariables['offset'] = staticVariableDefinition(
							'offset',
							'Int',
							existingPaginationArgs['offset']
						)
					}
					// add forwards cursor pagination
					else if (forwardPagination) {
						newVariables['first'] = staticVariableDefinition(
							'first',
							'Int',
							existingPaginationArgs['first']
						)
						newVariables['after'] = staticVariableDefinition(
							'after',
							'String',
							existingPaginationArgs['after']
						)
					}
					// add backwards cursor pagination
					else if (backwardsPagination) {
						newVariables['last'] = staticVariableDefinition(
							'last',
							'Int',
							existingPaginationArgs['last']
						)
						newVariables['before'] = staticVariableDefinition(
							'before',
							'String',
							existingPaginationArgs['before']
						)
					}

					// the full list of variables comes from both source
					const variableNames = new Set<string>(
						Object.keys(operationVariables).concat(Object.keys(newVariables))
					)

					// we need to build a unique set of variable definitions
					const finalVariables = [...variableNames].map(
						(name) => operationVariables[name] || newVariables[name]
					)

					return {
						...node,
						variableDefinitions: finalVariables,
					} as graphql.OperationDefinitionNode
				},
				// if we are dealing with a fragment definition we'll need to add the arguments directive if it doesn't exist
				FragmentDefinition(node) {
					fragment = true

					fragmentName = node.name.value

					// a fragment has to be embedded in Node if its not on the query type
					nodeQuery = node.typeCondition.name.value !== config.schema.getQueryType()?.name

					// look at the fragment definition for an arguments directive
					const argDirective = node.directives?.find(
						(directive) => directive.name.value === config.argumentsDirective
					)

					// if there isn't an arguments directive, add it and we'll add arguments to it when
					// we run into it again
					if (!argDirective) {
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
							offset: ['Int', existingPaginationArgs['offset']],
							limit: ['Int', existingPaginationArgs['limit']],
						})
					}
					// the field supports cursor based pagination
					else {
						// if the field supports forward pagination
						if (forwardPagination) {
							newArgs.push(
								...argumentsList({
									first: ['Int', existingPaginationArgs['first']],
									after: ['String', existingPaginationArgs['after']],
								})
							)
						}

						// the field could also support backwards pagination
						if (backwardsPagination) {
							newArgs.push(
								...argumentsList({
									last: ['Int', existingPaginationArgs['last']],
									before: ['String', existingPaginationArgs['before']],
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

			// now that we've mutated the document to be flexible for @paginate's needs
			// we need to add a document to perform the query if we are paginating on a
			// fragment
			if (!fragment) {
				continue
			}

			const fragmentSpreadSelection = [
				{
					kind: 'FragmentSpread',
					name: {
						kind: 'Name',
						value: fragmentName,
					},
					directives: [
						{
							kind: 'Directive',
							name: {
								kind: 'Name',
								value: config.withDirective,
							},
							arguments: paginationArgs.map(({ name }) => variableAsArgument(name)),
						},
					],
				},
			] as graphql.SelectionNode[]

			const queryDoc: graphql.DocumentNode = {
				kind: 'Document',
				definitions: [
					{
						kind: 'OperationDefinition',
						name: {
							kind: 'Name',
							value: fragmentName + '_Houdini_Paginate',
						},
						operation: 'query',
						variableDefinitions: paginationArgs
							.map(
								(arg) =>
									({
										kind: 'VariableDefinition',
										type: {
											kind: 'NamedType',
											name: {
												kind: 'Name',
												value: arg.type,
											},
										},
										variable: {
											kind: 'Variable',
											name: {
												kind: 'Name',
												value: arg.name,
											},
										},
										defaultValue: !existingPaginationArgs[arg.name]
											? undefined
											: {
													kind: (arg.type + 'Value') as
														| 'IntValue'
														| 'StringValue',
													value: existingPaginationArgs[arg.name],
											  },
									} as graphql.VariableDefinitionNode)
							)
							.concat(
								!nodeQuery
									? []
									: [
											{
												kind: 'VariableDefinition',
												type: {
													kind: 'NonNullType',
													type: {
														kind: 'NamedType',
														name: {
															kind: 'Name',
															value: 'ID',
														},
													},
												},
												variable: {
													kind: 'Variable',
													name: {
														kind: 'Name',
														value: 'id',
													},
												},
											},
									  ]
							),
						selectionSet: {
							kind: 'SelectionSet',
							selections: !nodeQuery
								? fragmentSpreadSelection
								: [
										{
											kind: 'Field',
											name: {
												kind: 'Name',
												value: 'node',
											},
											arguments: [
												{
													kind: 'Argument',
													name: {
														kind: 'Name',
														value: 'id',
													},
													value: {
														kind: 'Variable',
														name: {
															kind: 'Name',
															value: 'id',
														},
													},
												},
											],
											selectionSet: {
												kind: 'SelectionSet',
												selections: fragmentSpreadSelection,
											},
										},
								  ],
						},
					},
				],
			}

			// add a document to the list
			newDocs.push({
				filename: doc.filename,
				name: fragmentName + 'Houdini_Paginated',
				document: queryDoc,
				originalDocument: queryDoc,
			})
		}
	}

	// add every new doc we generated to the list
	documents.push(...newDocs)
}

function replaceArgumentsWithVariables(
	args: readonly graphql.ArgumentNode[] | undefined,
	vars: { [fieldName: string]: { enabled: boolean; type: 'String' | 'Int' } }
): {
	arguments: graphql.ArgumentNode[]
	values: { [key in keyof typeof vars]: any }
	paginationArguments: { type: string; name: string }[]
} {
	// we need to keep a map of wether we visited a field
	const values: { [key in keyof typeof vars]: any } = {}

	// hold onto any of the pagination-specific args in a separate list so we can easily embed references where we need
	const paginationArgs: { name: string; type: string }[] = []

	const seenArgs: Record<string, boolean> = {}

	const newArgs = (args || []).map((arg) => {
		// the specification for this variable
		const spec = vars[arg.name.value]
		// if the arg is not something we care about or is disabled we need to leave it alone
		if (!spec || !spec.enabled) {
			return arg
		}

		// if we are being passed a variable,
		if (arg.value.kind !== 'Variable') {
			const oldValue = (arg.value as graphql.StringValueNode).value

			// transform the value if we have to
			values[arg.name.value] = spec.type === 'Int' ? parseInt(oldValue) : oldValue
		}

		paginationArgs.push({ type: spec.type, name: arg.name.value })

		seenArgs[arg.name.value] = true

		// turn the field into a variable
		return variableAsArgument(arg.name.value)
	})

	// any fields that are enabled but don't have values need to have variable references add
	for (const name of Object.keys(vars)) {
		// the specification for this variable
		const spec = vars[name]

		// if we have a value or its disabled, ignore it
		if (values[name] || !spec.enabled || seenArgs[name]) {
			continue
		}

		// if we are looking at forward pagination args when backwards is enabled ignore it
		if (['first', 'after'].includes(name) && vars['before'].enabled) {
			continue
		}
		if (['last', 'before'].includes(name) && vars['first'].enabled) {
			continue
		}

		paginationArgs.push({ type: spec.type, name })

		// we need to add a variable referencing the argument
		newArgs.push(variableAsArgument(name))
	}

	return { arguments: newArgs, values, paginationArguments: paginationArgs }
}

function variableAsArgument(name: string): graphql.ArgumentNode {
	return {
		kind: 'Argument',
		name: {
			kind: 'Name',
			value: name,
		},
		value: {
			kind: 'Variable',
			name: {
				kind: 'Name',
				value: name,
			},
		},
	}
}

function staticVariableDefinition(name: string, type: string, defaultValue?: string) {
	return {
		kind: 'VariableDefinition',
		type: {
			kind: 'NamedType',
			name: {
				kind: 'Name',
				value: type,
			},
		},
		variable: {
			kind: 'Variable',
			name: {
				kind: 'Name',
				value: name,
			},
		},
		defaultValue: !defaultValue
			? undefined
			: {
					kind: (type + 'Value') as 'IntValue' | 'StringValue',
					value: defaultValue,
			  },
	} as graphql.VariableDefinitionNode
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

const pageInfoSelection = [
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
]
