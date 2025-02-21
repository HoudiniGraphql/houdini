import { green } from '@kitql/helpers'
import * as graphql from 'graphql'

import type { Config, Document, PaginateModes } from '../../../lib'
import {
	HoudiniError,
	LogLevel,
	definitionFromAncestors,
	parentField,
	parentTypeFromAncestors,
	siteURL,
	unwrapType,
} from '../../../lib'
import type { FragmentArgument } from '../transforms/fragmentVariables'
import {
	fragmentArguments as collectFragmentArguments,
	withArguments,
} from '../transforms/fragmentVariables'
import { connectionSelection } from '../transforms/list'

// typeCheck verifies that the documents are valid instead of waiting
// for the compiler to fail later down the line.
export default async function typeCheck(config: Config, docs: Document[]): Promise<void> {
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
	for (const { document: parsed, originalString, filename } of docs) {
		graphql.visit(parsed, {
			FragmentDefinition(definition) {
				fragments[definition.name.value] = definition
			},
			Directive(directive, _, parent, __, ancestors) {
				// only consider @paginate or @list
				if (
					![config.listDirective, config.paginateDirective].includes(directive.name.value)
				) {
					return
				}

				const { parents, definition } = definitionFromAncestors(ancestors)

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
					({ name }) => name.value === config.listOrPaginateNameArg
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

				const { type, error: errorConnectionSelection } = connectionSelection(
					config,
					targetFieldDefinition,
					parentTypeFromAncestors(
						config.schema,
						filename,
						ancestors
					) as graphql.GraphQLObjectType,
					targetField.selectionSet
				)

				// Add connection error only for @paginate
				if (errorConnectionSelection && directive.name.value === config.paginateDirective) {
					errors.push(
						new HoudiniError({
							filepath: filename,
							message: errorConnectionSelection,
							description: errorConnectionSelection,
						})
					)
				}

				// we need to validate that we have id configs for the target of the list
				let targetTypes: readonly graphql.GraphQLObjectType<any, any>[] = [type]

				// a union doesn't have fields itself so every possible type needs to have a valid key
				if (graphql.isUnionType(type)) {
					targetTypes = config.schema.getPossibleTypes(type)
				}
				// if the type is an abstract type, there are 2 options:
				// - either the user has configured a custom type for the interface
				// - the user has configured key fields for every constituent
				else if (graphql.isInterfaceType(type)) {
					// if the interface satisfies the default config, we're okay
					try {
						// look over every default key and validate it exists
						for (const key of config.keyFieldsForType(type.name)) {
							if (!type.getFields()[key]) {
								throw new Error('continue')
							}
						}
					} catch {
						// if we got an error then the interface does not satisfy the default
						// so we have to use the possible types in our check
						targetTypes = config.schema.getPossibleTypes(type)
					}
				}

				// make sure there is an id field
				for (const targetType of targetTypes) {
					const missingIDFields = config
						.keyFieldsForType(targetType.name)
						.filter((fieldName) => !targetType.getFields()[fieldName])

					if (missingIDFields.length > 0) {
						errors.push(
							new HoudiniError({
								filepath: filename,
								message:
									`@${config.listDirective} on ${green(
										targetType.name
									)} has a configuration issue: ` +
									`${targetType} dos not have a valid key. ` +
									`Please check this link for more information: https://houdinigraphql.com/guides/caching-data#custom-ids`,
							})
						)
						return
					}
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
	const rules = (filepath: string) => [
		// this will replace `KnownDirectives` and `KnownFragmentNames`
		validateLists({
			config,
			freeLists,
			lists,
			listTypes,
			fragments,
		}),
	]

	for (const { filename, document: parsed, originalString } of docs) {
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
						(arg) => arg.name.value === config.deprecatedlistDirectiveParentIDArg
					)
					if (parentArg) {
						ctx.reportError(
							new graphql.GraphQLError(
								`@${config.deprecatedlistDirectiveParentIDArg} should be defined only in it's own directive now`
							)
						)
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
				if (!config.isInternalDirective(node.name.value)) {
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
							`The following arguments are missing from the "${fragmentName}" fragment: ` +
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
					const zipped: [graphql.ArgumentNode, graphql.TypeNode][] =
						appliedArgumentNames.map((name) => [
							appliedArguments[name],
							fragmentArguments[fragmentName].find((arg) => arg.name === name)!.type,
						])

					for (const [applied, target] of zipped) {
						// if the two don't match up, its not a valid argument type
						if (!valueIsType(config, applied.value, target)) {
							ctx.reportError(
								new graphql.GraphQLError(
									`Invalid argument type. Expected ${target}, found ${applied.value.kind}`
								)
							)
						}
					}
				}
			},
		}
	}
}

// returns true if two type nodes are equal
export function valueIsType(
	config: Config,
	value: graphql.ValueNode,
	targetType: graphql.TypeNode
): boolean {
	// if we were passed null then we can answer the question
	if (value.kind === 'NullValue') {
		// the value is correct if the targe type is not non-null
		return targetType.kind !== 'NonNullType'
	}

	// we know we aren't passing a null value

	// let's shed a non-null
	if (targetType.kind === 'NonNullType') {
		targetType = targetType.type
	}

	// process list values
	if (value.kind === 'ListValue') {
		// if the target type is not a list we're done
		if (targetType.kind !== 'ListType') {
			return false
		}
		const listType = targetType.type

		// if we weren't expecting a list value, we're done
		return value.values.every((value) => valueIsType(config, value, listType))
	}

	// we have scalar values so we need to make sure that the type match
	if (value.kind === 'BooleanValue') {
		return targetType.kind === 'NamedType' && targetType.name.value === 'Boolean'
	}
	if (value.kind === 'StringValue') {
		return targetType.kind === 'NamedType' && targetType.name.value === 'String'
	}
	if (value.kind === 'IntValue') {
		return targetType.kind === 'NamedType' && targetType.name.value === 'Int'
	}
	if (value.kind === 'FloatValue') {
		return targetType.kind === 'NamedType' && targetType.name.value === 'Float'
	}
	if (value.kind === 'ObjectValue' && targetType.kind === 'NamedType') {
		// if we are passing an object value as a type we have to trust it as a valid
		// value for a scalar
		return true
	}
	if (value.kind === 'EnumValue' && targetType.kind === 'NamedType') {
		// we need to look up the target type in the schema and see if the enum matches
		const enumType = config.schema.getType(targetType.name.value)

		// if the targe type isn't an enum, then we have a problem
		if (!graphql.isEnumType(enumType)) {
			return false
		}

		// its a valid value if its a possible value of the enum
		return enumType.getValues().some((enumValue) => enumValue.value === value.value)
	}

	// if its a variable, let's just say yes
	if (value.kind === 'Variable') {
		return true
	}

	// if we got this far we dont recognize the situation so skip it
	return false
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

					// paginateMode
					const paginateModeArg = node?.arguments?.find(
						(arg) => arg.name.value === config.paginateModeArg
					)
					let paginateMode: PaginateModes = config.defaultPaginateMode
					if (paginateModeArg && paginateModeArg.value.kind === 'EnumValue') {
						paginateMode = paginateModeArg.value.value as PaginateModes
					}

					if (forward && backwards && paginateMode === 'Infinite') {
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
				let { definition } = definitionFromAncestors(ancestors)

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
						new graphql.GraphQLError(paginateOnNonNodeMessage(node.name.value))
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

function checkMaskDirectives(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			FragmentSpread(node, _, __, ___, ancestors) {
				const maskEnableDirective = node.directives?.find(
					(c) => c.name.value === config.maskEnableDirective
				)

				const maskDisableDirective = node.directives?.find(
					(c) => c.name.value === config.maskDisableDirective
				)

				if (maskEnableDirective && maskDisableDirective) {
					ctx.reportError(
						new graphql.GraphQLError(
							`You can't apply both @${config.maskEnableDirective} and @${config.maskDisableDirective} at the same time`
						)
					)
					return
				}
			},
		}
	}
}

function validateLoadingDirective(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		let global = false

		return {
			enter: {
				OperationDefinition(node) {
					// if the operation has the loading mutation its being applied globally
					if (node.directives?.find((d) => d.name.value === config.loadingDirective)) {
						global = true
					}
				},
				FragmentDefinition(node) {
					// if the operation has the loading mutation its being applied globally
					if (node.directives?.find((d) => d.name.value === config.loadingDirective)) {
						global = true
					}
				},
			},
			FragmentSpread(node, _, __, ___, ancestors) {
				// we only care about fields with the loading directive
				const loadingDirective = node.directives?.find(
					(d) => d.name.value === config.loadingDirective
				)
				if (!loadingDirective) {
					return
				}

				const parent = parentField(ancestors)

				// if the parent is a definition of some kind, we're okay
				if (
					!parent ||
					['OperationDefinition', 'FragmentDefinition'].includes(parent.kind)
				) {
					return
				}

				// the loading directive is considered valid if the parent _has_ the directive applied
				const parentLoading = parent.directives?.find(
					(d) => d.name.value === config.loadingDirective
				)

				if (!parentLoading && !global) {
					ctx.reportError(
						new graphql.GraphQLError(
							`@${config.loadingDirective} can only be applied on a field or fragment spread at the root of a document or on one whose parent also has @${config.loadingDirective}`
						)
					)
				}
			},
			Field(node, _, __, ___, ancestors) {
				// we only care about fields with the loading directive
				const loadingDirective = node.directives?.find(
					(d) => d.name.value === config.loadingDirective
				)
				if (!loadingDirective) {
					return
				}

				const parent = parentField(ancestors)

				// if the parent is a definition of some kind, we're okay
				if (
					!parent ||
					['OperationDefinition', 'FragmentDefinition'].includes(parent.kind)
				) {
					return
				}

				// the loading directive is considered valid if the parent _has_ the directive applied
				const parentLoading = parent.directives?.find(
					(d) => d.name.value === config.loadingDirective
				)

				if (!parentLoading && !global) {
					ctx.reportError(
						new graphql.GraphQLError(
							`@${config.loadingDirective} can only be applied on a field or fragment spread at the root of a document or on one whose parent also has @${config.loadingDirective}`
						)
					)
				}
			},
		}
	}
}

function validateOptimisticKeys(config: Config) {
	return function (ctx: graphql.ValidationContext): graphql.ASTVisitor {
		const typeInfo = new graphql.TypeInfo(config.schema)
		return graphql.visitWithTypeInfo(typeInfo, {
			[graphql.Kind.SELECTION_SET]: (node, _, __, ___, ancestors) => {
				// track if we find an optimistic key directive
				let found: string[] = []
				// look at every field in the selection set
				for (const selection of node.selections) {
					// if we find the directive, mark it
					if (
						selection.kind === 'Field' &&
						selection.directives?.find(
							(d) => d.name.value === config.optimisticKeyDirective
						)
					) {
						// add the field to the list
						found.push(selection.name.value)
					}
				}

				// if we did find a directive make sure that we found the directive on
				// every key for the type
				if (found.length > 0) {
					const doc = ancestors[0] as graphql.DocumentNode
					const operation = doc.definitions?.find(
						(def) => def.kind === 'OperationDefinition'
					)
					if (
						operation &&
						(operation as graphql.OperationDefinitionNode).operation !== 'mutation'
					) {
						ctx.reportError(
							new graphql.GraphQLError(
								`@${config.optimisticKeyDirective} can only be in mutations`
							)
						)
						return
					}

					const parent = typeInfo.getParentType()
					if (!parent) {
						return
					}
					const keys = config.keyFieldsForType(parent.name)
					// make sure that the two lists match
					if (keys.length !== found.length || !keys.every((key) => found.includes(key))) {
						ctx.reportError(
							new graphql.GraphQLError(
								`@${config.optimisticKeyDirective} must be applied to every key field for a type`
							)
						)
					}
				}
			},
		})
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
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// look for a field on the query type to look up a node by id
	const queryType = schema.getQueryType()
	if (!queryType) {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// look for a node field
	const nodeField = queryType.getFields()['node']
	if (!nodeField) {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// there needs to be an arg on the field called id
	const args = nodeField.args
	if (args.length === 0) {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// look for the id arg
	const idArg = args.find((arg) => arg.name === config.defaultKeys[0])
	if (!idArg) {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// make sure that the id arg takes an ID
	const idType = unwrapType(config, idArg.type)
	// make sure its an ID
	if (idType.type.name !== 'ID') {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	// make sure that the node field returns a Node
	const fieldReturnType = unwrapType(config, nodeField.type)
	if (fieldReturnType.type.name !== 'Node') {
		displayInvalidNodeFieldMessage(config)
		return null
	}

	return nodeInterface as graphql.GraphQLInterfaceType
}

let nbInvalidNodeFieldMessageDisplayed = 0
function displayInvalidNodeFieldMessage(config: Config) {
	// We want to display the message only once.
	if (nbInvalidNodeFieldMessageDisplayed === 0) {
		if (config.logLevel === LogLevel.Full) {
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

const paginateOnNonNodeMessage = (directiveName: string) =>
	`It looks like you are trying to use @${directiveName} on a document that does not have a valid type resolver.
If this is happening inside of a fragment, make sure that the fragment either implements the Node interface or you
have defined a resolver entry for the fragment type.

For more information, please visit these links:
- ${siteURL}/guides/pagination#paginated-fragments
- ${siteURL}/guides/caching-data#custom-ids
`
