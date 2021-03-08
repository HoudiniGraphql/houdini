// externals
import { Config, getTypeFromAncestors } from 'houdini-common'
import * as graphql from 'graphql'
import KnownArgumentNamesRule from 'graphql/validation/rules/KnownArgumentNamesRule'
// locals
import { CollectedGraphQLDocument } from '../types'
import { HoudiniError, HoudiniErrorTodo } from '../error'

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
	const fragments: string[] = []

	// visit every document and build up the lists
	for (const { document: parsed } of docs) {
		graphql.visit(parsed, {
			[graphql.Kind.FRAGMENT_DEFINITION](definition) {
				fragments.push(definition.name.value)
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
					// look at the next entry for a list or someting else that would make us
					// require a parent ID
					rootType = rootType?.getFields()[parent.name.value].type
				}

				parents = [...ancestors] as (
					| graphql.FieldNode
					| graphql.InlineFragmentNode
					| graphql.FragmentDefinitionNode
					| graphql.OperationDefinitionNode
					| graphql.SelectionSetNode
				)[]
				parents.reverse()
				const parentType = getTypeFromAncestors(config.schema, parents)

				// if we have already seen the connection name there's a problem
				const connectionName = nameArg.value.value
				if (connections.includes(connectionName)) {
					errors.push(new HoudiniErrorTodo('Connection names must be unique'))
					return
				}

				// add the connection to the list
				connections.push(connectionName)
				connectionTypes.push(parentType.name)

				// if we still dont need a parent by now, add it to the list of free connections
				if (!needsParent) {
					freeConnections.push(connectionName)
				}
			},
		})
	}

	// build up the list of rules we'll apply to every document
	const rules = [...graphql.specifiedRules]
		.filter(
			// remove the rules that conflict with our
			(rule) =>
				![
					// fragments are defined on their own so unused fragments are a fact of life
					graphql.NoUnusedFragmentsRule,
					// query documents don't contain the fragments they use so we can't enforce
					// that we know every fragment. this is replaced with a more appopriate version
					// down below
					graphql.KnownFragmentNamesRule,
					// some of the documents (ie the injected ones) will contain directive defintions
					// and therefor not be explicitly executable
					graphql.ExecutableDefinitionsRule,
					// connection include directives that aren't defined by the schema. this
					// is replaced with a more appopriate version down below
					graphql.KnownDirectivesRule,
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
			})
		)

	for (const { filename, document: parsed, printed } of docs) {
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
	fragments: string[]
}) =>
	function verifyConnectionArtifacts(ctx: graphql.ValidationContext): graphql.ASTVisitor {
		return {
			// if we run into a fragment spread
			FragmentSpread(node) {
				// if the fragment is not a connection fragment dont do the normal processing
				if (!config.isConnectionFragment(node.name.value)) {
					// make sure its a defined fragment
					if (!fragments.includes(node.name.value)) {
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
				// if ther is no directive
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
				if (!config.isConnectionOperationDirective(directiveName)) {
					return
				}

				// if the directive points to a type we dont recognize as the target of a connection
				if (!connectionTypes.includes(config.connectionNameFromDirective(directiveName))) {
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
