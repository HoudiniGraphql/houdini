import * as graphql from 'graphql'

import {
	Config,
	definitionFromAncestors,
	LogLevel,
	parentTypeFromAncestors,
	HoudiniError,
	siteURL,
	CollectedGraphQLDocument,
} from '../../lib'
import {
	FragmentArgument,
	fragmentArguments as collectFragmentArguments,
	withArguments,
} from '../transforms/fragmentVariables'
import { connectionSelection } from '../transforms/list'
import { unwrapType } from '../utils'

// typeCheck verifies that the documents are valid instead of waiting
// for the compiler to fail later down the line.
export default async function typeCheck(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// wrap the errors we run into in a HoudiniError
	const errors: Error[] = []

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

	// before we can validate everything, we need to look for the valid list names and
	// check if they need a parent specification (if they fall inside of a fragment on something other than Query)
	for (const { document: parsed, filename } of docs) {
		graphql.visit(parsed, {
			[graphql.Kind.FRAGMENT_DEFINITION](definition) {
				fragments[definition.name.value] = definition
			},
			[graphql.Kind.DIRECTIVE](directive, _, parent, __, ancestors) {
				// only consider @paginate or @list
				if (
					![config.listDirective, config.paginateDirective].includes(directive.name.value)
				) {
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
				let needsParent = false

				// if we are looking at an operation that's not query
				if (
					(definition.kind !== 'OperationDefinition' &&
						definition.kind !== 'FragmentDefinition') ||
					(definition.kind === 'OperationDefinition' && definition.operation !== 'query')
				) {
					errors.push(
						new Error(
							`@${directive.name.value} can only appear in queries or fragments`
						)
					)
					return
				}

				// we need to figure out the type of the list so lets start walking down
				// the list of parents starting at the root type
				let rootType: graphql.GraphQLNamedType | undefined | null =
					definition.kind === 'OperationDefinition'
						? config.schema.getQueryType()
						: config.schema.getType(definition.typeCondition.name.value)
				if (!rootType) {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message: 'Could not find root type',
						})
					)
					return
				}

				// go over the rest of the parent tree
				for (const parent of parents) {
					// if we are looking at a list or selection set, ignore it
					if (Array.isArray(parent) || parent.kind === 'SelectionSet') {
						continue
					}

					if (parent.kind === 'InlineFragment' && parent.typeCondition) {
						rootType = config.schema.getType(parent.typeCondition.name.value)
						continue
					}

					// if the directive isn't a field we have a problem
					if (parent.kind !== 'Field') {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message: "Shouldn't get here",
							})
						)
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
					if (graphql.isNonNullType(rootType) && 'ofType' in rootType) {
						rootType = rootType.ofType as graphql.GraphQLNamedType
					}

					// if we hit a scalar
					if (graphql.isScalarType(rootType)) {
						// we're done
						break
					}

					// @ts-ignore
					// look at the next entry for a list or something else that would make us
					// require a parent ID
					// if [parent.name.value] doesn't exist, the document is not valid and it will be catch later
					rootType = rootType?.getFields()[parent.name.value]?.type
				}

				// if we found a pagination directive, make sure that it doesn't
				// fall under a list (same logic as @list needing a parent)
				if (directive.name.value === config.paginateDirective) {
					// if we need a parent, we can't paginate it
					if (needsParent) {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message: `@${config.paginateDirective} cannot be below a list`,
							})
						)
					}
				}

				// if we got this far, we need a parent if we're under any fragment
				// since a list mutation can't compute the parent from the owner of the fragment
				needsParent = needsParent || definition.kind === 'FragmentDefinition'

				// look up the name of the list
				const nameArg = directive.arguments?.find(
					({ name }) => name.value === config.listNameArg
				)

				if (!nameArg) {
					// if we are looking at @list there is an error
					if (directive.name.value === config.listDirective) {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message: 'Could not find name arg',
							})
						)
					}

					// regardless there's nothing more to process
					return
				}
				if (nameArg.value.kind !== 'StringValue') {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message:
								'Name arg must be a static string, it cannot be set to a variable.',
						})
					)
					return
				}

				// if we have already seen the list name there's a problem
				const listName = nameArg.value.value
				if (lists.includes(listName)) {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message: 'List names must be unique',
						})
					)
					return
				}

				// in order to figure out the targets for the list we need to look at the field
				// definition
				const pType = parentTypeFromAncestors(
					config.schema,
					filename,
					ancestors.slice(0, -1)
				)
				const targetField = ancestors[ancestors.length - 1] as graphql.FieldNode
				const targetFieldDefinition = pType.getFields()[
					targetField.name.value
				] as graphql.GraphQLField<any, any>

				const { type, error } = connectionSelection(
					config,
					targetFieldDefinition,
					parentTypeFromAncestors(
						config.schema,
						filename,
						ancestors
					) as graphql.GraphQLObjectType,
					targetField.selectionSet
				)

				// make sure there is an id field
				const missingIDFields = config
					.keyFieldsForType(type.name)
					.filter((fieldName) => !type.getFields()[fieldName])

				if (missingIDFields.length > 0) {
					if (error) {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message: error,
							})
						)
					} else {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message: `@${
									config.listDirective
								} can only be applied to types with the necessary id fields: ${missingIDFields.join(
									', '
								)}.`,
							})
						)
					}
					return
				}

				// add the list to the list
				lists.push(listName)
				listTypes.push(type.name)

				// if we still don't need a parent by now, add it to the list of free lists
				if (!needsParent) {
					freeLists.push(listName)
				}
			},
		})
	}

	// if we got errors
	if (errors.length > 0) {
		throw errors
	}

	// there was nothing wrong, we're ready validate the documents totally

	// build up the list of rules we'll apply to every document
	const rules = (filepath: string) =>
		[...graphql.specifiedRules]
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
				// checkMutationOperation
				checkMutationOperation(config),
				// pagination directive can only show up on nodes or the query type
				nodeDirectives(config, [config.paginateDirective]),
				// this replaces KnownArgumentNamesRule
				knownArguments(config),
				// validate any fragment arguments
				validateFragmentArguments(config, filepath, fragments),
				// make sure there are pagination args on fields marked with @paginate
				paginateArgs(config, filepath),
				// make sure every argument defined in a fragment is used
				noUnusedFragmentArguments(config)
			)

	for (const { filename, document: parsed } of docs) {
		// validate the document
		for (const error of graphql.validate(config.schema, parsed, rules(filename))) {
			errors.push(
				new HoudiniError({
					filepath: filename,
					message: error.message,
				})
			)
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

				// Do we have the parentId another way?
				let parentIdFound = false
				// look for one of the list directives
				directive = node.directives?.find(({ name }) => [
					[config.listPrependDirective, config.listAppendDirective].includes(name.value),
				])
				if (directive) {
					// find the argument holding the parent ID
					let parentArg = directive.arguments?.find(
						(arg) => arg.name.value === config.listDirectiveParentIDArg
					)
					if (parentArg) {
						parentIdFound = true
					}
				}

				if (parentIdFound) {
					// parentId was found, so we're good to go
					return
				}

				// look for allLists directive
				const allLists = node.directives?.find(
					({ name }) => config.listAllListsDirective === name.value
				)

				// if there is the directive or it's
				if (allLists || config.defaultListTarget === 'all') {
					return
				}

				ctx.reportError(
					new graphql.GraphQLError(
						`For this list fragment, you need to add or @${config.listParentDirective} or @${config.listAllListsDirective} directive to specify the behavior`
					)
				)
				return
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
				if (
					[
						config.argumentsDirective,
						config.withDirective,
						config.whenDirective,
						config.whenNotDirective,
						config.listAppendDirective,
						config.listPrependDirective,
					].includes(directiveName)
				) {
					return false
				}

				// otherwise use the default validator
				return (nativeValidator as any).Directive(directiveNode)
			},
		}
	}
}

function validateFragmentArguments(
	config: Config,
	filepath: string,
	fragments: Record<string, graphql.FragmentDefinitionNode>
) {
	// map a fragment name to the list of required args
	const requiredArgs: Record<string, string[]> = {}
	// map fragment name to the list of all the args
	const fragmentArgumentNames: Record<string, string[]> = {}
	// map fragment names to the argument nodes
	const fragmentArguments: Record<string, FragmentArgument[]> = {}

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
				// if we don't recognize the fragment, this validator should ignore it. someone else
				// will handle the error message
				if (!fragments[targetFragment.name.value]) {
					return
				}

				// dry up the fragment name
				const fragmentName = targetFragment.name.value

				// if we haven't computed the required arguments for the fragment, do it now
				if (!requiredArgs[fragmentName]) {
					let args: FragmentArgument[]
					try {
						// look up the arguments for the fragment
						args = collectFragmentArguments(config, filepath, fragments[fragmentName])
					} catch (e) {
						ctx.reportError(new graphql.GraphQLError((e as Error).message))
						return
					}

					fragmentArguments[fragmentName] = args
					requiredArgs[fragmentName] = args
						.filter((arg) => arg && arg.required)
						.map((arg) => arg.name)
					fragmentArgumentNames[fragmentName] = args.map((arg) => arg.name)
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
					return
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
					const zipped: [graphql.ArgumentNode, string][] = appliedArgumentNames.map(
						(name) => [
							appliedArguments[name],
							fragmentArguments[fragmentName].find((arg) => arg.name === name)!.type,
						]
					)

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

						// if the two don't match up, its not a valid argument type
						if (appliedType !== target) {
							ctx.reportError(
								new graphql.GraphQLError(
									`Invalid argument type. Expected ${target}, found ${appliedType}`
								)
							)
						}
					}
				}
			},
		}
	}
}

function paginateArgs(config: Config, filepath: string) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		// track if we have seen a paginate directive (to error on the second one)
		let alreadyPaginated = false

		return {
			Directive(node, _, __, ___, ancestors) {
				// only consider pagination directives
				if (node.name.value !== config.paginateDirective) {
					return
				}

				// if we have already run into a paginated field, yell loudly
				if (alreadyPaginated) {
					ctx.reportError(
						new graphql.GraphQLError(
							`@${config.paginateDirective} can only appear in a document once.`
						)
					)
				}

				// make sure we fail if we see another paginated field
				alreadyPaginated = true

				// find the definition containing the directive
				const definition = definitionFromAncestors(ancestors)

				// look at the fragment arguments
				const definitionArgs = collectFragmentArguments(
					config,
					filepath,
					definition as graphql.FragmentDefinitionNode
				)

				// a fragment marked for pagination can't have required args
				const hasRequiredArgs = definitionArgs.find((arg) => arg.required)
				if (hasRequiredArgs) {
					ctx.reportError(
						new graphql.GraphQLError(
							'@paginate cannot appear on a document with required args'
						)
					)
					return
				}

				// look at the field the directive is applied to
				const targetFieldType = parentTypeFromAncestors(
					config.schema,
					filepath,
					ancestors.slice(0, -1)
				)
				const targetField = ancestors.slice(-1)[0] as graphql.FieldNode

				// look at the possible args for the type to figure out if its a cursor-based
				const type = targetFieldType.getFields()[
					targetField.name.value
				] as graphql.GraphQLField<any, any>

				// if the type doesn't exist, don't do anything someone else will pick up the error
				if (!type) {
					return
				}

				// get a summary of the types defined on the field
				const fieldArgs = type.args.reduce<Record<string, string>>(
					(args, arg) => ({
						...args,
						[arg.name]: unwrapType(config, arg.type).type.name,
					}),
					{}
				)

				const forwardPagination =
					fieldArgs['first'] === 'Int' && fieldArgs['after'] === 'String'

				const backwardsPagination =
					fieldArgs['last'] === 'Int' && fieldArgs['before'] === 'String'

				// a field with cursor based pagination must have the first arg and one of before or after
				const cursorPagination = forwardPagination || backwardsPagination

				// create a summary of the applied args
				const appliedArgs = new Set(targetField.arguments?.map((arg) => arg.name.value))

				// if the field supports cursor based pagination, there must be a first argument applied
				if (cursorPagination) {
					const forward = appliedArgs.has('first')
					const backwards = appliedArgs.has('last')

					if (!forward && !backwards) {
						ctx.reportError(
							new graphql.GraphQLError(
								'A field with cursor-based pagination must have a first or last argument'
							)
						)
					}

					if (forward && backwards) {
						ctx.reportError(
							new graphql.GraphQLError(
								`A field with cursor pagination cannot go forwards an backwards simultaneously`
							)
						)
					}

					return
				}

				// a field with offset based paginate must have offset and limit args
				const offsetPagination =
					fieldArgs['offset'] === 'Int' && fieldArgs['limit'] === 'Int'
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

function noUnusedFragmentArguments(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		// if we run into a fragment definition with arguments we need to make sure every argument is used
		const args = new Set<string>()

		return {
			// when we first see a fragment definition
			enter(node) {
				if (node.kind === graphql.Kind.FRAGMENT_DEFINITION) {
					const definitionArguments = node.directives
						?.filter((directive) => directive.name.value === config.argumentsDirective)
						.flatMap((directive) => directive.arguments!)

					for (const arg of definitionArguments?.map((arg) => arg?.name.value) || []) {
						args.add(arg)
					}
				} else if (node.kind === graphql.Kind.VARIABLE) {
					args.delete(node.name.value)
				}
			},
			leave(node) {
				// once we're done with the definition make sure we used everything
				if (node.kind === graphql.Kind.FRAGMENT_DEFINITION) {
					if (args.size > 0) {
						ctx.reportError(
							new graphql.GraphQLError(
								'Encountered unused fragment arguments: ' + [...args].join(',')
							)
						)
					}
				}
			},
		}
	}
}

function nodeDirectives(config: Config, directives: string[]) {
	const queryType = config.schema.getQueryType()

	let possibleNodes = [queryType?.name || '']
	const customTypes = Object.keys(config.typeConfig || {})

	// check if there's a node interface
	const nodeInterface = getAndVerifyNodeInterface(config)
	if (nodeInterface) {
		const { objects, interfaces } = config.schema.getImplementations(nodeInterface)
		possibleNodes.push(
			...objects.map((object) => object.name),
			...interfaces.map((object) => object.name)
		)
	}
	if (customTypes.length > 1) {
		possibleNodes.push(...customTypes)
	}

	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		// if there is no node
		return {
			Directive(node, _, __, ___, ancestors) {
				// only look at the target directives
				if (!directives.includes(node.name.value)) {
					return
				}

				// look through the ancestor list for the definition node
				let definition = definitionFromAncestors(ancestors)

				// if the definition points to an operation, it must point to a query
				let definitionType = ''
				if (definition.kind === 'OperationDefinition') {
					// if the definition is for something other than a query
					if (definition.operation !== 'query') {
						ctx.reportError(
							new graphql.GraphQLError(
								`@${node.name.value} must fall on a fragment or query document`
							)
						)
						return
					}
					definitionType = config.schema.getQueryType()?.name || ''
				} else if (definition.kind === 'FragmentDefinition') {
					definitionType = definition.typeCondition.name.value
				}

				// if the fragment is not on the query type or an implementor of node
				if (!possibleNodes.includes(definitionType)) {
					ctx.reportError(
						new graphql.GraphQLError(paginateOnNonNodeMessage(config, node.name.value))
					)
				}
			},
		}
	}
}

function checkMutationOperation(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			FragmentSpread(node, _, __, ___, ancestors) {
				const append = node.directives?.find(
					(c) => c.name.value === config.listAppendDirective
				)

				const prepend = node.directives?.find(
					(c) => c.name.value === config.listPrependDirective
				)
				if (append && prepend) {
					ctx.reportError(
						new graphql.GraphQLError(
							`You can't apply both @${config.listPrependDirective} and @${config.listAppendDirective} at the same time`
						)
					)
					return
				}

				const parentId = node.directives?.find(
					(c) => c.name.value === config.listParentDirective
				)
				const allLists = node.directives?.find(
					(c) => c.name.value === config.listAllListsDirective
				)
				if (parentId && allLists) {
					ctx.reportError(
						new graphql.GraphQLError(
							`You can't apply both @${config.listParentDirective} and @${config.listAllListsDirective} at the same time`
						)
					)
					return
				}
			},
		}
	}
}

export function getAndVerifyNodeInterface(config: Config): graphql.GraphQLInterfaceType | null {
	const { schema } = config

	// look for Node
	const nodeInterface = schema.getType('Node')

	// if there is no node interface don't do anything else
	if (!nodeInterface) {
		return null
	}

	// make sure its an interface
	if (!graphql.isInterfaceType(nodeInterface)) {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// look for a field on the query type to look up a node by id
	const queryType = schema.getQueryType()
	if (!queryType) {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// look for a node field
	const nodeField = queryType.getFields()['node']
	if (!nodeField) {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// there needs to be an arg on the field called id
	const args = nodeField.args
	if (args.length === 0) {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// look for the id arg
	const idArg = args.find((arg) => arg.name === 'id')
	if (!idArg) {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// make sure that the id arg takes an ID
	const idType = unwrapType(config, idArg.type)
	// make sure its an ID
	if (idType.type.name !== 'ID') {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	// make sure that the node field returns a Node
	const fieldReturnType = unwrapType(config, nodeField.type)
	if (fieldReturnType.type.name !== 'Node') {
		displayInvalidNodeFieldMessage(config.logLevel)
		return null
	}

	return nodeInterface as graphql.GraphQLInterfaceType
}

let nbInvalidNodeFieldMessageDisplayed = 0
function displayInvalidNodeFieldMessage(logLevel: LogLevel) {
	// We want to display the message only once.
	if (nbInvalidNodeFieldMessageDisplayed === 0) {
		if (logLevel === LogLevel.Full) {
			console.warn(invalidNodeFieldMessage)
		} else {
			console.warn(invalidNodeFieldMessageLight)
		}
	}
	nbInvalidNodeFieldMessageDisplayed++
}

const invalidNodeFieldMessageLight = `⚠️  Your Node interface is not properly defined, please fix your schema to be able to use this interface. (For more info, add flag "-l full")`

const invalidNodeFieldMessage = `⚠️  Your project defines a Node interface but it does not conform to the Global Identification Spec.

If you are trying to provide the Node interface and its field, they must look like the following:

interface Node {
	id: ID!
}

extend type Query {
	node(id: ID!): Node
}

For more information, please visit these links:
- https://graphql.org/learn/global-object-identification/
- ${siteURL}/guides/caching-data#custom-ids
`

const paginateOnNonNodeMessage = (config: Config, directiveName: string) =>
	`It looks like you are trying to use @${directiveName} on a document that does not have a valid type resolver.
If this is happening inside of a fragment, make sure that the fragment either implements the Node interface or you
have defined a resolver entry for the fragment type.

For more information, please visit these links:
- ${siteURL}/guides/pagination#paginated-fragments
- ${siteURL}/guides/caching-data#custom-ids
`
