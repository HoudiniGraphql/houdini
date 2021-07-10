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
//   add the necessary arguments to the field, referencing variables that will be inject
// - if the @paginate directive was found, add the @arguments directive to the fragment
//   definition and use any fields that were previously set as the default value. that
//   causes the fragment arguments directive to inline the default values if one isn't
//   given, preserving the original definition for the first query
// - generate the query with the fragment embedded using @with to pass query variables through

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
		let forwardPagination = false
		let backwardsPagination = false
		let offsetPagination = false

		let existingPaginationArgs: { [key: string]: any } = {}

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

				// figure out what kind of pagination we support
				forwardPagination = args.has('first') && args.has('after')
				backwardsPagination = args.has('last') && args.has('before')
				offsetPagination = args.has('offset') && args.has('limit')

				let { arguments: nodeArguments, values } = replaceArgumentsWithVariables(
					node.arguments,
					{
						first: {
							enabled: forwardPagination,
							transform: parseInt,
						},
						after: {
							enabled: forwardPagination,
						},
						last: {
							enabled: backwardsPagination,
							transform: parseInt,
						},
						before: {
							enabled: backwardsPagination,
						},
						limit: {
							enabled: offsetPagination,
							transform: parseInt,
						},
						offset: {
							enabled: offsetPagination,
							transform: parseInt,
						},
					}
				)

				// extract the values we care about so the fragment argument definition
				// can use them for default values
				existingPaginationArgs = values
				forwardPagination = Boolean(values['first'])
				backwardsPagination = !forwardPagination

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
			// add the arguments directive if it doesn't exist
			doc.document = graphql.visit(doc.document, {
				FragmentDefinition(node) {
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
		}
	}
}

function replaceArgumentsWithVariables(
	args: readonly graphql.ArgumentNode[] | undefined,
	vars: { [fieldName: string]: { enabled: boolean; transform?: (val: string) => any } }
): { arguments: graphql.ArgumentNode[]; values: { [key in keyof typeof vars]: any } } {
	// we need to keep a map of wether we visited a field
	const values: { [key in keyof typeof vars]: any } = {}

	const newArgs = (args || []).map((arg) => {
		// the specification for this variable
		const spec = vars[arg.name.value]
		// if the arg is not something we care about or is disabled we need to leave it alone
		if (!spec || !spec.enabled) {
			return arg
		}

		const oldValue = (arg.value as graphql.StringValueNode).value

		// transform the value if we have to
		values[arg.name.value] = spec.transform ? spec.transform(oldValue) : oldValue

		// turn the field into a variable
		return variableAsArgument(arg.name.value)
	})

	// any fields that are enabled but don't have values need to have variable references add
	for (const name of Object.keys(vars)) {
		// if we have a value or its disabled, ignore it
		if (values[name] || !vars[name].enabled) {
			continue
		}

		// if we are looking at forward pagination args when backwards is enabled ignore it
		if (['first', 'after'].includes(name) && vars['before'].enabled) {
			continue
		}
		if (['last', 'before'].includes(name) && vars['first'].enabled) {
			continue
		}

		// we need to add a variable referencing the argument
		newArgs.push(variableAsArgument(name))
	}

	return { arguments: newArgs, values }
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
