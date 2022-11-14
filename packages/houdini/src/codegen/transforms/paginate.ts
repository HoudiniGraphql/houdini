import * as graphql from 'graphql'

import { Config, HoudiniError, parentTypeFromAncestors, CollectedGraphQLDocument } from '../../lib'
import { ArtifactKind, RefetchUpdateMode } from '../../runtime/lib/types'
import { unwrapType, wrapType } from '../utils'

// the paginate transform is responsible for preparing a fragment marked for pagination
// to be embedded in the query that will be used to fetch additional data. That means it
// is responsible for adding additional arguments to the paginated field and hoisting
// all of the pagination args to arguments of the fragment itself. It then generates
// a query that threads query variables to the updated fragment and lets the fragment
// argument transform do the rest. This whole process happens in a few steps:

// - walk through the document and look for a field marked for pagination. if one is found,
//   add the necessary arguments to the field, referencing variables that will be injected
//   and compute what kind of pagination (toggling an object of flags)
// - if the @paginate directive was found, add the @arguments directive to the fragment
//   definition to pass new pagination arguments and use any fields that were previously
//   set as the default value. That will cause the fragment arguments directive to inline
//   the default values if one isn't given, preserving the original definition for the first query
// - generate the query with the fragment embedded using @with to pass query variables through

type PaginationFlags = {
	[fieldName: string]: {
		enabled: boolean
		type: string
		defaultValue?: any
		variableName?: string
	}
}

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

		// store the pagination state to coordinate what we define as args to the field and the argument definitions of
		// the fragment and operation. we'll fill in the enabled state and default values once we encounter @paginate
		const flags: PaginationFlags = {
			first: {
				enabled: false,
				type: 'Int',
			},
			after: {
				enabled: false,
				type: 'String',
			},
			last: {
				enabled: false,
				type: 'Int',
			},
			before: {
				enabled: false,
				type: 'String',
			},
			limit: {
				enabled: false,
				type: 'Int',
			},
			offset: {
				enabled: false,
				type: 'Int',
			},
		}

		let cursorType = 'String'

		// we need to know the path where the paginate directive shows up so we can distinguish updated
		// values from data that needs to be added to the list
		let paginationPath: string[] = []

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
				const fieldTypeFields = (
					parentTypeFromAncestors(config.schema, doc.filename, ancestors) as
						| graphql.GraphQLObjectType
						| graphql.GraphQLInterfaceType
				).getFields()[node.name.value]
				const args = new Set(fieldTypeFields.args.map((arg) => arg.name))

				// also look to see if the user wants to do forward pagination
				const passedArgs = new Set(node.arguments?.map((arg) => arg.name.value))
				const specifiedForwards = passedArgs.has('first')
				const specifiedBackwards = passedArgs.has('last')

				cursorType =
					(
						fieldTypeFields.args?.find((arg) => ['before', 'after'].includes(arg.name))
							?.type as graphql.GraphQLNamedType
					)?.name || 'String'
				flags.after.type = cursorType
				flags.before.type = cursorType

				// figure out what kind of pagination the field supports
				const forwardPagination =
					!specifiedBackwards && args.has('first') && args.has('after')
				const backwardsPagination =
					!specifiedForwards && args.has('last') && args.has('before')
				const offsetPagination =
					!forwardPagination &&
					!backwardsPagination &&
					args.has('offset') &&
					args.has('limit')

				// update the flags based on what the tagged field supports
				flags.first.enabled = forwardPagination
				flags.after.enabled = forwardPagination
				flags.last.enabled = backwardsPagination
				flags.before.enabled = backwardsPagination
				flags.offset.enabled = offsetPagination
				flags.limit.enabled = offsetPagination

				paginationPath = (
					ancestors
						.filter(
							(ancestor) =>
								// @ts-ignore
								!Array.isArray(ancestor) && ancestor.kind === graphql.Kind.FIELD
						)
						.concat(node) as graphql.FieldNode[]
				).map((field) => field.alias?.value || field.name.value)

				// if the field supports cursor based pagination we need to make sure we have the
				// page info field
				return {
					...node,
					// any pagination arguments we run into will need to be replaced with variables
					// since they will be hoisted into the arguments for the fragment or query
					arguments: replaceArgumentsWithVariables(node.arguments, flags),
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

		// if we saw the paginate directive we need to add arguments to the fragment or query that contain the
		// field that is marked for pagination
		if (paginated) {
			let fragmentName = ''
			let refetchQueryName = ''
			// check if we have to embed the fragment in Node
			let nodeQuery = false

			// figure out the right refetch
			let refetchUpdate = RefetchUpdateMode.append
			if (flags.last.enabled) {
				refetchUpdate = RefetchUpdateMode.prepend
			}

			// remember if we found a fragment or operation
			let fragment = ''

			doc.document = graphql.visit(doc.document, {
				// if we are dealing with a query, we'll need to add the variables to the definition
				OperationDefinition(node) {
					// make sure its a query
					if (node.operation !== 'query') {
						throw new HoudiniError({
							filepath: doc.filename,
							message: `@${config.paginateDirective} can only show up in a query or fragment document`,
						})
					}

					refetchQueryName = node.name?.value || ''

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
					let newVariables: Record<string, graphql.VariableDefinitionNode> =
						Object.fromEntries(
							Object.entries(flags)
								.filter(
									([, spec]) =>
										// let's tale the spec enabled AND where we don't have a dedicated variable for it
										spec.enabled && spec.variableName === undefined
								)
								.map(([fieldName, spec]) => [
									fieldName,
									staticVariableDefinition(
										fieldName,
										spec.type,
										spec.defaultValue,
										spec.variableName
									),
								])
						)

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
					fragment = node.typeCondition.name.value

					fragmentName = node.name.value
					refetchQueryName = config.paginationQueryName(fragmentName)

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
									kind: graphql.Kind.DIRECTIVE,
									name: {
										kind: graphql.Kind.NAME,
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

					// turn the set of enabled pagination args into arg definitions for the directive
					let newArgs = [
						...Object.entries(flags)
							.filter(([, spec]) => spec.enabled)
							.map(([key, spec]) =>
								argumentNode(key, [spec.type, spec.defaultValue])
							),
					]

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

			// figure out the 'target' type of the refetch
			let targetType = config.schema.getQueryType()?.name || ''
			if (fragment) {
				const nodeInterface = config.schema.getType('Node') as graphql.GraphQLInterfaceType
				if (nodeInterface) {
					const { objects, interfaces } = config.schema.getImplementations(nodeInterface)

					if (
						objects.find((obj) => obj.name === fragment) ||
						interfaces.find((int) => int.name === fragment)
					) {
						targetType = 'Node'
					} else {
						targetType = fragment
					}
				} else {
					targetType = fragment
				}
			}

			// add the paginate info to the collected document
			doc.refetch = {
				update: refetchUpdate,
				path: paginationPath,
				method: flags.first.enabled || flags.last.enabled ? 'cursor' : 'offset',
				pageSize: 0,
				embedded: nodeQuery,
				targetType,
				paginated: true,
				direction: flags.last.enabled ? 'backwards' : 'forward',
			}

			// add the correct default page size
			if (flags.first.enabled) {
				doc.refetch.pageSize = flags.first.defaultValue
				doc.refetch.start = flags.after.defaultValue
			} else if (flags.last.enabled) {
				doc.refetch.pageSize = flags.last.defaultValue
				doc.refetch.start = flags.before.defaultValue
			} else if (flags.limit.enabled) {
				doc.refetch.pageSize = flags.limit.defaultValue
				doc.refetch.start = flags.offset.defaultValue
			}

			// if we're not paginating a fragment, there's nothing more to do. we mutated
			// the query's definition to contain the arguments we need to get more data
			// and we can just use it for refetches
			if (!fragment) {
				continue
			}
			// grab the enabled fields to create the list of arguments for the directive
			const paginationArgs = Object.entries(flags)
				.filter(([_, { enabled }]) => enabled)
				.map(([key, value]) => ({ name: key, ...value }))

			const fragmentSpreadSelection = [
				{
					kind: graphql.Kind.FRAGMENT_SPREAD,
					name: {
						kind: graphql.Kind.NAME,
						value: fragmentName,
					},
					directives: [
						{
							kind: graphql.Kind.DIRECTIVE,
							name: {
								kind: graphql.Kind.NAME,
								value: config.withDirective,
							},
							['arguments']: paginationArgs.map(({ name }) =>
								variableAsArgument(name)
							),
						},
					],
				},
			] as graphql.SelectionNode[]

			// we are going to add arguments for every key the type is configured with
			const keys = config
				.keyFieldsForType(!nodeQuery ? config.schema.getQueryType()?.name || '' : fragment)
				.flatMap((key) => {
					// if we are looking at the query, don't add anything
					if (fragment === config.schema.getQueryType()?.name) {
						return []
					}

					// look up the type for each key
					const fragmentType = config.schema.getType(fragment) as
						| graphql.GraphQLObjectType
						| graphql.GraphQLInterfaceType

					const { type, wrappers } = unwrapType(
						config,
						fragmentType.getFields()[key].type
					)

					return [
						{
							name: key,
							type: wrapType({ type, wrappers }),
						},
					]
				})

			const typeConfig = config.typeConfig?.[fragment]

			const queryDoc: graphql.DocumentNode = {
				kind: graphql.Kind.DOCUMENT,
				definitions: [
					{
						kind: graphql.Kind.OPERATION_DEFINITION,
						name: {
							kind: graphql.Kind.NAME,
							value: refetchQueryName,
						},
						operation: 'query',
						variableDefinitions: paginationArgs
							.map(
								(arg) =>
									({
										kind: graphql.Kind.VARIABLE_DEFINITION,
										type: {
											kind: graphql.Kind.NAMED_TYPE,
											name: {
												kind: graphql.Kind.NAME,
												value: arg.type,
											},
										},
										variable: {
											kind: graphql.Kind.VARIABLE,
											name: {
												kind: graphql.Kind.NAME,
												value: arg.name,
											},
										},
										defaultValue: !flags[arg.name].defaultValue
											? undefined
											: {
													kind: (arg.type + 'Value') as
														| 'IntValue'
														| 'StringValue',
													value: flags[arg.name].defaultValue,
											  },
									} as graphql.VariableDefinitionNode)
							)
							.concat(
								!nodeQuery
									? []
									: keys.map(
											(key) =>
												({
													kind: graphql.Kind.VARIABLE_DEFINITION,
													type: key.type,
													variable: {
														kind: graphql.Kind.VARIABLE,
														name: {
															kind: graphql.Kind.NAME,
															value: key.name,
														},
													},
												} as graphql.VariableDefinitionNode)
									  )
							),
						selectionSet: {
							kind: graphql.Kind.SELECTION_SET,
							selections: !nodeQuery
								? fragmentSpreadSelection
								: [
										{
											kind: graphql.Kind.FIELD,
											name: {
												kind: graphql.Kind.NAME,
												value: typeConfig?.resolve?.queryField || 'node',
											},
											['arguments']: keys.map((key) => ({
												kind: graphql.Kind.ARGUMENT,
												name: {
													kind: graphql.Kind.NAME,
													value: key.name,
												},
												value: {
													kind: graphql.Kind.VARIABLE,
													name: {
														kind: graphql.Kind.NAME,
														value: key.name,
													},
												},
											})),
											selectionSet: {
												kind: graphql.Kind.SELECTION_SET,
												selections: [
													// make sure we look up the type of the result
													{
														kind: graphql.Kind.FIELD,
														name: {
															kind: graphql.Kind.NAME,
															value: '__typename',
														},
													},
													// make sure every key field is present
													...(typeConfig?.keys || ['id']).map((key) => ({
														kind: graphql.Kind.FIELD,
														name: {
															kind: graphql.Kind.NAME,
															value: key,
														},
													})),
													...fragmentSpreadSelection,
												] as graphql.SelectionNode[],
											},
										},
								  ],
						},
					},
				],
			}

			// add a document to the list
			newDocs.push({
				kind: ArtifactKind.Query,
				filename: doc.filename,
				name: refetchQueryName,
				document: queryDoc,
				originalDocument: queryDoc,
				generateArtifact: true,
				generateStore: false,
				refetch: doc.refetch,
				originalString: '',
			})
		}
	}

	// add every new doc we generated to the list
	documents.push(...newDocs)
}

function replaceArgumentsWithVariables(
	args: readonly graphql.ArgumentNode[] | undefined,
	flags: PaginationFlags
): graphql.ArgumentNode[] {
	const seenArgs: Record<string, boolean> = {}

	const newArgs = (args || []).map((arg) => {
		// the specification for this variable
		const spec = flags[arg.name.value]
		// if the arg is not something we care about or is disabled we need to leave it alone
		if (!spec || !spec.enabled) {
			return arg
		}

		// if the argument isn't being passed a variable, we will need to set a default value
		if (arg.value.kind !== 'Variable') {
			const oldValue = (arg.value as graphql.StringValueNode).value

			// transform the value if we have to and save the default value
			flags[arg.name.value].defaultValue = spec.type === 'Int' ? parseInt(oldValue) : oldValue
		}

		// if we have a variable
		if (arg.value.kind === 'Variable') {
			flags[arg.name.value].variableName = arg.value.name.value
		}

		seenArgs[arg.name.value] = true

		// turn the field into a variable
		return variableAsArgument(arg.name.value, flags[arg.name.value].variableName)
	})

	// any fields that are enabled but don't have values need to have variable references add
	for (const name of Object.keys(flags)) {
		// the specification for this variable
		const spec = flags[name]

		// if we have a value or its disabled, ignore it
		if (flags[name].defaultValue || !spec.enabled || seenArgs[name]) {
			continue
		}

		// if we are looking at forward pagination args when backwards is enabled ignore it
		if (['first', 'after'].includes(name) && flags['before'].enabled) {
			continue
		}
		// same but opposite for backwards pagination
		if (['last', 'before'].includes(name) && flags['first'].enabled) {
			continue
		}

		// we need to add a variable referencing the argument
		newArgs.push(variableAsArgument(name))
	}

	return newArgs
}

function variableAsArgument(name: string, variable?: string): graphql.ArgumentNode {
	return {
		kind: graphql.Kind.ARGUMENT,
		name: {
			kind: graphql.Kind.NAME,
			value: name,
		},
		value: {
			kind: graphql.Kind.VARIABLE,
			name: {
				kind: graphql.Kind.NAME,
				value: variable ?? name,
			},
		},
	}
}

function staticVariableDefinition(
	name: string,
	type: string,
	defaultValue?: string,
	variableName?: string
) {
	return {
		kind: graphql.Kind.VARIABLE_DEFINITION,
		type: {
			kind: graphql.Kind.NAMED_TYPE,
			name: {
				kind: graphql.Kind.NAME,
				value: type,
			},
		},
		variable: {
			kind: graphql.Kind.VARIABLE,
			name: {
				kind: graphql.Kind.NAME,
				value: variableName ?? name,
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

function argumentNode(
	name: string,
	value: [string, number | string | undefined]
): graphql.ArgumentNode {
	return {
		kind: graphql.Kind.ARGUMENT,
		name: {
			kind: graphql.Kind.NAME,
			value: name,
		},
		value: objectNode(value),
	}
}

function objectNode([type, defaultValue]: [
	string,
	number | string | undefined
]): graphql.ObjectValueNode {
	const node = {
		kind: graphql.Kind.OBJECT,
		fields: [
			{
				kind: graphql.Kind.OBJECT_FIELD,
				name: {
					kind: graphql.Kind.NAME,
					value: 'type',
				},
				value: {
					kind: graphql.Kind.STRING,
					value: type,
				},
			},
		] as graphql.ObjectFieldNode[],
	}

	// if there's a default value, add it
	if (defaultValue) {
		node.fields.push({
			kind: graphql.Kind.OBJECT_FIELD,
			name: { kind: graphql.Kind.NAME, value: 'default' } as graphql.NameNode,
			value: {
				kind: typeof defaultValue === 'number' ? 'IntValue' : 'StringValue',
				value: defaultValue.toString(),
			},
		} as graphql.ObjectFieldNode)
	}

	return node
}

export const pageInfoSelection = [
	{
		kind: graphql.Kind.FIELD,
		name: {
			kind: graphql.Kind.NAME,
			value: 'edges',
		},
		selectionSet: {
			kind: graphql.Kind.SELECTION_SET,
			selections: [
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'cursor',
					},
				},
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'node',
					},
					selectionSet: {
						kind: graphql.Kind.SELECTION_SET,
						selections: [
							{
								kind: graphql.Kind.FIELD,
								name: {
									kind: graphql.Kind.NAME,
									value: '__typename',
								},
							},
						],
					},
				},
			],
		},
	},
	{
		kind: graphql.Kind.FIELD,
		name: {
			kind: graphql.Kind.NAME,
			value: 'pageInfo',
		},
		selectionSet: {
			kind: graphql.Kind.SELECTION_SET,
			selections: [
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'hasPreviousPage',
					},
				},
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'hasNextPage',
					},
				},
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'startCursor',
					},
				},
				{
					kind: graphql.Kind.FIELD,
					name: {
						kind: graphql.Kind.NAME,
						value: 'endCursor',
					},
				},
			],
		},
	},
]
