// externals
import { Config, parentTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
// locals
import { CollectedGraphQLDocument, HoudiniError, HoudiniErrorTodo } from '../types'
import {
	fragmentArguments as collectFragmentArguments,
	withArguments,
} from '../transforms/fragmentVariables'
import { unwrapType } from '../utils'

// typeCheck verifies that the documents are valid instead of waiting
// for the compiler to fail later down the line.
export default async function typeCheck(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// wrap the errors we run into in a HoudiniError
	const errors: HoudiniError[] = []

	// we need to catch errors in the list API. this means that a user
	// must provide parentID if they are using a list that is not all-objects
	// from root. figure out which lists are "free" (ie, can be applied without a parentID arg)
	const freeLists: string[] = []
	// we also want to keep track of all list names so we can validate the mutation fragments
	const lists: string[] = []
	// keep track of every type in a list so we can validate the directives too
	const listTypes: string[] = []
	// keep track of every fragment that's defined in the set
	const fragments: Record<string, graphql.FragmentDefinitionNode> = {}

	// visit every document and build up the lists
	for (const { document: parsed } of docs) {
		graphql.visit(parsed, {
			[graphql.Kind.FRAGMENT_DEFINITION](definition) {
				fragments[definition.name.value] = definition
			},
			[graphql.Kind.DIRECTIVE](directive, _, parent, __, ancestors) {
				// if the fragment is a list fragment
				if (directive.name.value !== config.listDirective) {
					return
				}

				// look up the name of the list
				const nameArg = directive.arguments?.find(
					({ name }) => name.value === config.listNameArg
				)

				if (!nameArg) {
					errors.push(new HoudiniErrorTodo('Could not find name arg'))
					return
				}
				if (nameArg.value.kind !== 'StringValue') {
					errors.push(
						new HoudiniErrorTodo(
							'Name arg must be a static string, it cannot be set to a variable.'
						)
					)
					return
				}

				// in order to look up field type information we have to start at the parent
				// and work our way down
				// note:  the top-most parent is always gonna be a document so we ignore it
				let parents = [...ancestors] as (
					| graphql.FieldNode
					| graphql.InlineFragmentNode
					| graphql.FragmentDefinitionNode
					| graphql.OperationDefinitionNode
					| graphql.SelectionSetNode
				)[]
				parents.shift()

				// the first meaningful parent is a definition of some kind
				let definition = parents.shift() as
					| graphql.FragmentDefinitionNode
					| graphql.OperationDefinitionNode
				while (Array.isArray(definition) && definition) {
					// @ts-ignore
					definition = parents.shift()
				}

				// look at the list of ancestors to see if we required a parent ID
				let needsParent = definition.kind === 'FragmentDefinition'

				// if we are looking at an operation that's not query
				if (
					(definition.kind !== 'OperationDefinition' &&
						definition.kind !== 'FragmentDefinition') ||
					(definition.kind === 'OperationDefinition' && definition.operation !== 'query')
				) {
					errors.push(new Error('@list can only appear in queries or fragments'))
					return
				}

				// we need to figure out the type of the list so lets start walking down
				// the list of parents starting at the root type
				let rootType: graphql.GraphQLNamedType | undefined | null =
					definition.kind === 'OperationDefinition'
						? config.schema.getQueryType()
						: config.schema.getType(definition.typeCondition.name.value)
				if (!rootType) {
					errors.push(new Error('Could not find root type'))
					return
				}

				// go over the rest of the parent tree
				for (const parent of parents) {
					// if we are looking at a list or selection set, ignore it
					if (
						Array.isArray(parent) ||
						parent.kind === 'SelectionSet' ||
						parent.kind === 'InlineFragment'
					) {
						continue
					}

					// if the directive isn't a field we have a problem
					if (parent.kind !== 'Field') {
						errors.push(new HoudiniErrorTodo("Shouldn't get here"))
						return
					}

					// if we are looking at a list type
					if (
						graphql.isListType(rootType) ||
						(graphql.isNonNullType(rootType) && graphql.isListType(rootType.ofType))
					) {
						// we need an id to know which element to add to
						needsParent = true
						break
					}

					// if we have a non-null type, unwrap it
					if (graphql.isNonNullType(rootType)) {
						rootType = rootType.ofType
					}

					// if we hit a scalar
					if (graphql.isScalarType(rootType)) {
						// we're done
						break
					}

					// @ts-ignore
					// look at the next entry for a list or something else that would make us
					// require a parent ID
					rootType = rootType?.getFields()[parent.name.value].type
				}

				const parentType = parentTypeFromAncestors(config.schema, ancestors)

				// if we have already seen the list name there's a problem
				const listName = nameArg.value.value
				if (lists.includes(listName)) {
					errors.push(new HoudiniErrorTodo('List names must be unique'))
					return
				}

				// add the list to the list
				lists.push(listName)
				listTypes.push(parentType.name)

				// if we still don't need a parent by now, add it to the list of free lists
				if (!needsParent) {
					freeLists.push(listName)
				}
			},
		})
	}

	// build up the list of rules we'll apply to every document
	const rules = [...graphql.specifiedRules]
		.filter(
			// remove rules that conflict with houdini
			(rule) =>
				![
					// fragments are defined on their own so unused fragments are a fact of life
					graphql.NoUnusedFragmentsRule,
					// query documents don't contain the fragments they use so we can't enforce
					// that we know every fragment. this is replaced with a more appropriate version
					// down below
					graphql.KnownFragmentNamesRule,
					// some of the documents (ie the injected ones) will contain directive definitions
					// and therefor not be explicitly executable
					graphql.ExecutableDefinitionsRule,
					// list include directives that aren't defined by the schema. this
					// is replaced with a more appropriate version down below
					graphql.KnownDirectivesRule,
					// a few directives such at @arguments and @with don't have static names. this is
					// replaced with a more flexible version below
					graphql.KnownArgumentNamesRule,
				].includes(rule)
		)
		.concat(
			// this will replace `KnownDirectives` and `KnownFragmentNames`
			validateLists({
				config,
				freeLists,
				lists,
				listTypes,
				fragments,
			}),
			// this replaces KnownArgumentNamesRule
			knownArguments(config),
			// validate any fragment arguments
			fragmentArguments(config, fragments),
			// make sure there are pagination args
			paginationArgs(config)
		)

	for (const { filename, document: parsed } of docs) {
		// validate the document
		for (const error of graphql.validate(config.schema, parsed, rules)) {
			errors.push({
				...error,
				filepath: filename,
			})
		}
	}

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// we're done here
	return
}

//

// build up the custom rule that requires parentID on all list directives
// applied to list fragment spreads whose name does not appear in `freeLists`
const validateLists = ({
	config,
	freeLists,
	lists,
	listTypes,
	fragments,
}: {
	config: Config
	freeLists: string[]
	lists: string[]
	listTypes: string[]
	fragments: Record<string, graphql.FragmentDefinitionNode>
}) =>
	function verifyListArtifacts(ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			// if we run into a fragment spread
			FragmentSpread(node) {
				// if the fragment is not a list fragment don't do the normal processing
				if (!config.isListFragment(node.name.value)) {
					// make sure its a defined fragment
					if (!fragments[node.name.value]) {
						ctx.reportError(
							new graphql.GraphQLError(
								'Encountered unknown fragment: ' + node.name.value
							)
						)
					}

					return
				}
				// compute the name of the list from the fragment
				const listName = config.listNameFromFragment(node.name.value)

				// make sure we know the list
				if (!lists.includes(listName)) {
					ctx.reportError(
						new graphql.GraphQLError(
							'Encountered fragment referencing unknown list: ' + listName
						)
					)
					return
				}

				// if the list fragment doesn't need a parent ID, we can ignore it
				if (freeLists.includes(listName)) {
					return
				}

				// the typechecker will verify that there is a value passed to @parentID
				// so if it exists, we're good to go
				let directive = node.directives?.find(
					({ name }) => name.value === config.listParentDirective
				)
				if (directive) {
					// there's nothing else to check
					return
				}

				// look for one of the list directives
				directive = node.directives?.find(({ name }) => [
					[config.listPrependDirective, config.listAppendDirective].includes(name.value),
				])
				// if there is no directive
				if (!directive) {
					ctx.reportError(
						new graphql.GraphQLError('parentID is required for this list fragment')
					)
					return
				}

				// find the argument holding the parent ID
				let parentArg = directive.arguments?.find(
					(arg) => arg.name.value === config.listDirectiveParentIDArg
				)

				if (!parentArg) {
					ctx.reportError(
						new graphql.GraphQLError('parentID is required for this list fragment')
					)
					return
				}
			},
			// if we run into a directive that points to a list, make sure that list exists
			Directive(node) {
				const directiveName = node.name.value

				// if the user is using @connection, tell them it was removed
				if (directiveName === 'connection') {
					ctx.reportError(
						new graphql.GraphQLError(
							'@connection was renamed to @list. Please change your components. ' +
								'If you were using `cache.connection` in your components, you will need to update that to `cache.list` too.'
						)
					)
					return
				}

				// if the directive is not a list directive
				if (!config.isInternalDirective(node)) {
					// look for the definition of the fragment
					if (!config.schema.getDirective(directiveName)) {
						ctx.reportError(
							new graphql.GraphQLError(
								'Encountered unknown directive: ' + directiveName
							)
						)
					}

					return
				}

				// if the directive points to a type we don't recognize as the target of a list
				if (
					config.isListOperationDirective(directiveName) &&
					!listTypes.includes(config.listNameFromDirective(directiveName))
				) {
					ctx.reportError(
						new graphql.GraphQLError(
							'Encountered directive referencing unknown list: ' + directiveName
						)
					)
					return
				}
			},
		}
	}

function knownArguments(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		// grab the default known arguments validator
		const nativeValidator = graphql.KnownArgumentNamesRule(ctx)

		// keep the default arguments validator (it doesn't check directives)
		return {
			...nativeValidator,
			Directive(directiveNode) {
				// the name of the directive
				const directiveName = directiveNode.name.value

				// if the directive points to the arguments or with directive, we don't
				// need the arguments to be defined
				if ([config.argumentsDirective, config.withDirective].includes(directiveName)) {
					return false
				}

				// otherwise use the default validator
				return (nativeValidator as any).Directive(directiveNode)
			},
		}
	}
}

function fragmentArguments(
	config: Config,
	fragments: Record<string, graphql.FragmentDefinitionNode>
) {
	// map a fragment name to the list of required args
	const requiredArgs: Record<string, string[]> = {}
	// map fragment name to the list of all the args
	const fragmentArgumentNames: Record<string, string[]> = {}
	// map fragment names to the argument nodes
	const fragmentArguments: Record<string, graphql.ArgumentNode[]> = {}

	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			Directive(node) {
				// if we are not looking at the argument definition directive, ignore it
				if (node.name.value !== config.argumentsDirective) {
					return
				}

				// look at every argument
				for (const arg of node.arguments || []) {
					// the value must be an object
					if (arg.value.kind !== 'ObjectValue') {
						ctx.reportError(
							new graphql.GraphQLError('values in @arguments must be an object')
						)
						return
					}

					// grab the type argument
					const typeArg = arg.value.fields.find((field) => field.name.value === 'type')
					const defaultValue = arg.value.fields.find(
						(field) => field.name.value === 'default'
					)

					// if there is no type value
					if (!typeArg) {
						ctx.reportError(
							new graphql.GraphQLError('missing type field for @arguments directive')
						)
						return
					}

					// make sure that the two types at least match
					if (typeArg.value.kind !== graphql.Kind.STRING) {
						ctx.reportError(
							new graphql.GraphQLError('type field to @arguments must be a string')
						)
						return
					}

					// if there is no default value, we're done
					if (!defaultValue) {
						return
					}

					const defaultValueType = defaultValue.value.kind.substring(
						0,
						defaultValue.value.kind.length - 'Value'.length
					)

					// if the claimed type does not match the default value there's an error
					if (typeArg.value.value !== defaultValueType) {
						ctx.reportError(
							new graphql.GraphQLError(
								`Invalid default value provided for ${arg.name.value}. Expected ${typeArg.value.value}, found ${defaultValueType}`
							)
						)
						return
					}
				}
			},
			FragmentSpread(targetFragment, _, __, ___, ancestors) {
				// if we dont recognize the fragment, this validator should ignore it. someone else
				// will handle the error message
				if (!fragments[targetFragment.name.value]) {
					return
				}

				// dry up the fragment name
				const fragmentName = targetFragment.name.value

				// if we haven't computed the required arguments for the fragment, do it now
				if (!requiredArgs[fragmentName]) {
					// look up the arguments for the fragment
					const args = collectFragmentArguments(config, fragments[fragmentName])

					fragmentArguments[fragmentName] = args
					requiredArgs[fragmentName] = args
						.filter(
							(arg) =>
								arg.value.kind === 'ObjectValue' &&
								// any arg without a default value key in its body is required
								!arg.value.fields.find((field) => field.name.value === 'default')
						)
						.map((arg) => arg.name.value)
					fragmentArgumentNames[fragmentName] = args.map((arg) => arg.name.value)
				}

				// get the arguments applied through with
				const appliedArguments: Record<string, graphql.ArgumentNode> = withArguments(
					config,
					targetFragment
				).reduce(
					(map, arg) => ({
						...map,
						[arg.name.value]: arg,
					}),
					{}
				)
				const appliedArgumentNames = Object.keys(appliedArguments)

				// find the missing arguments
				const missing = requiredArgs[fragmentName].filter(
					(arg) => !appliedArgumentNames.includes(arg)
				)

				if (missing.length > 0) {
					ctx.reportError(
						new graphql.GraphQLError(
							'The following arguments are missing from this fragment: ' +
								JSON.stringify(missing)
						)
					)
				}

				// look for any args that we don't recognize
				const unknown = appliedArgumentNames.filter(
					(arg) => !fragmentArgumentNames[fragmentName].includes(arg)
				)
				if (unknown.length > 0) {
					ctx.reportError(
						new graphql.GraphQLError(
							'Encountered unknown arguments: ' + JSON.stringify(unknown)
						)
					)
				}
				// every argument corresponds to one defined in the fragment
				else {
					// zip together the provided argument with the one in the fragment definition
					const zipped: [
						graphql.ArgumentNode,
						graphql.ArgumentNode
					][] = appliedArgumentNames.map((name) => [
						appliedArguments[name],
						fragmentArguments[fragmentName].find(
							(arg) => arg.name.value === name
						) as graphql.ArgumentNode,
					])

					for (const [applied, target] of zipped) {
						// TODO: validate these types
						// if the applied value is a variable, list, or object don't validate it
						if (
							applied.value.kind === graphql.Kind.VARIABLE ||
							applied.value.kind === graphql.Kind.LIST ||
							applied.value.kind === graphql.Kind.OBJECT
						) {
							continue
						}

						// the applied value isn't a variable
						const appliedType = applied.value.kind.substring(
							0,
							applied.value.kind.length - 'Value'.length
						)

						// find the type argument
						const typeField = (target.value as graphql.ObjectValueNode).fields.find(
							(field) => field.name.value === 'type'
						)?.value
						if (typeField?.kind !== 'StringValue') {
							ctx.reportError(
								new graphql.GraphQLError(
									'type field of @arguments must be a string'
								)
							)
							return
						}
						const targetType = typeField.value

						// if the two don't match up, its not a valid argument type
						if (appliedType !== targetType) {
							ctx.reportError(
								new graphql.GraphQLError(
									`Invalid argument type. Expected ${targetType}, found ${appliedType}`
								)
							)
						}
					}
				}
			},
		}
	}
}

function paginationArgs(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			Directive(node, _, __, ___, ancestors) {
				// only consider pagination directives
				if (node.name.value !== config.paginateDirective) {
					return
				}

				// look at the field the directive is applied to
				const targetFieldType = parentTypeFromAncestors(
					config.schema,
					ancestors.slice(0, -1)
				)
				const targetField = ancestors.slice(-1)[0] as graphql.FieldNode

				// look at the possible args for the type to figure out if its a cursor-based
				const { args: fieldArgs } = targetFieldType.getFields()[
					targetField.name.value
				] as graphql.GraphQLField<any, any>

				const firstArg = fieldArgs.find(
					(arg) =>
						arg.name === 'first' && unwrapType(config, arg.type).type.name === 'Int'
				)
				const afterArg = fieldArgs.find(
					(arg) =>
						arg.name === 'after' && unwrapType(config, arg.type).type.name === 'String'
				)
				const beforeArg = fieldArgs.find(
					(arg) =>
						arg.name === 'before' && unwrapType(config, arg.type).type.name === 'String'
				)

				// a field with cursor based pagination must have the first arg and one of before or after
				const cursorPagination = firstArg && (afterArg || beforeArg)

				// if the field supports cursor based pagination, there must be a first argument applied
				if (cursorPagination) {
					const appliedFirstArg = targetField.arguments?.find(
						(arg) => arg.name.value === 'first'
					)

					if (!appliedFirstArg) {
						ctx.reportError(
							new graphql.GraphQLError(
								'A field with cursor-based pagination must have a first argument'
							)
						)
					}

					return
				}

				// a field with offset based paginate must have offset and limit args
				const offsetPagination =
					fieldArgs.filter(
						(arg) =>
							(arg.name === 'offset' &&
								unwrapType(config, arg.type).type.name === 'Int') ||
							(arg.name === 'limit' &&
								unwrapType(config, arg.type).type.name === 'Int')
					).length === 2

				if (offsetPagination) {
					const appliedLimitArg = targetField.arguments?.find(
						(arg) => arg.name.value === 'limit'
					)

					if (!appliedLimitArg) {
						ctx.reportError(
							new graphql.GraphQLError(
								'A field with offset-based pagination must have a limit argument'
							)
						)
					}

					return
				}
			},
		}
	}
}
