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

	// we need to catch errors in the connection API. this means that a user
	// must provide parentID if they are using a connection that is not all-objects
	// from root. figure out which connections are "free" (ie, can be applied without a parentID arg)
	const freeConnections: string[] = []
	// we also want to keep track of all connection names so we can validate the mutation fragments
	const connections: string[] = []
	// keep track of every type in a connection so we can validate the directives too
	const connectionTypes: string[] = []
	// keep track of every fragment that's defined in the set
	const fragments: Record<string, graphql.FragmentDefinitionNode> = {}

	// visit every document and build up the lists
	for (const { document: parsed } of docs) {
		graphql.visit(parsed, {
			[graphql.Kind.FRAGMENT_DEFINITION](definition) {
				fragments[definition.name.value] = definition
			},
			[graphql.Kind.DIRECTIVE](directive, _, parent, __, ancestors) {
				// if the fragment is a connection fragment
				if (directive.name.value !== config.connectionDirective) {
					return
				}

				// look up the name of the connection
				const nameArg = directive.arguments?.find(
					({ name }) => name.value === config.connectionNameArg
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
					errors.push(new Error('@connection can only appear in queries or fragments'))
					return
				}

				// we need to figure out the type of the connection so lets start walking down
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

				// if we have already seen the connection name there's a problem
				const connectionName = nameArg.value.value
				if (connections.includes(connectionName)) {
					errors.push(new HoudiniErrorTodo('Connection names must be unique'))
					return
				}

				// add the connection to the list
				connections.push(connectionName)
				connectionTypes.push(parentType.name)

				// if we still don't need a parent by now, add it to the list of free connections
				if (!needsParent) {
					freeConnections.push(connectionName)
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
					// connection include directives that aren't defined by the schema. this
					// is replaced with a more appropriate version down below
					graphql.KnownDirectivesRule,
					// a few directives such at @arguments and @with don't have static names. this is
					// replaced with a more flexible version below
					graphql.KnownArgumentNamesRule,
				].includes(rule)
		)
		.concat(
			// this will replace `KnownDirectives` and `KnownFragmentNames`
			validateConnections({
				config,
				freeConnections,
				connections,
				connectionTypes,
				fragments,
			}),
			// this replaces KnownArgumentNamesRule
			knownDirectives(config),
			// validate any fragment arguments
			fragmentArguments(config, fragments)
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

// build up the custom rule that requires parentID on all connection directives
// applied to connection fragment spreads whose name does not appear in `freeConnections`
const validateConnections = ({
	config,
	freeConnections,
	connections,
	connectionTypes,
	fragments,
}: {
	config: Config
	freeConnections: string[]
	connections: string[]
	connectionTypes: string[]
	fragments: Record<string, graphql.FragmentDefinitionNode>
}) =>
	function verifyConnectionArtifacts(ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			// if we run into a fragment spread
			FragmentSpread(node) {
				// if the fragment is not a connection fragment don't do the normal processing
				if (!config.isConnectionFragment(node.name.value)) {
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
				// compute the name of the connection from the fragment
				const connectionName = config.connectionNameFromFragment(node.name.value)

				// make sure we know the connection
				if (!connections.includes(connectionName)) {
					ctx.reportError(
						new graphql.GraphQLError(
							'Encountered fragment referencing unknown connection: ' + connectionName
						)
					)
					return
				}

				// if the connection fragment doesn't need a parent ID, we can ignore it
				if (freeConnections.includes(connectionName)) {
					return
				}

				// the typechecker will verify that there is a value passed to @parentID
				// so if it exists, we're good to go
				let directive = node.directives?.find(
					({ name }) => name.value === config.connectionParentDirective
				)
				if (directive) {
					// there's nothing else to check
					return
				}

				// look for one of the connection directives
				directive = node.directives?.find(({ name }) => [
					[config.connectionPrependDirective, config.connectionAppendDirective].includes(
						name.value
					),
				])
				// if there is no directive
				if (!directive) {
					ctx.reportError(
						new graphql.GraphQLError(
							'parentID is required for this connection fragment'
						)
					)
					return
				}

				// find the argument holding the parent ID
				let parentArg = directive.arguments?.find(
					(arg) => arg.name.value === config.connectionDirectiveParentIDArg
				)

				if (!parentArg) {
					ctx.reportError(
						new graphql.GraphQLError(
							'parentID is required for this connection fragment'
						)
					)
					return
				}
			},
			// if we run into a directive that points to a connection, make sure that connection exists
			Directive(node) {
				const directiveName = node.name.value

				// if the directive is not a connection directive
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

				// if the directive points to a type we don't recognize as the target of a connection
				if (
					config.isConnectionOperationDirective(directiveName) &&
					!connectionTypes.includes(config.connectionNameFromDirective(directiveName))
				) {
					ctx.reportError(
						new graphql.GraphQLError(
							'Encountered directive referencing unknown connection: ' + directiveName
						)
					)
					return
				}
			},
		}
	}

function knownDirectives(config: Config) {
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
								!arg.value.fields.find(
									(field) => field.name.value === 'defaultValue'
								)
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
