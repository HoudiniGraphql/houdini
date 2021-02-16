// externals
import { Config, isListType } from 'houdini-common'
import * as graphql from 'graphql'
import { NoUnusedFragments } from 'graphql/validation/rules/NoUnusedFragments'
import { KnownFragmentNames } from 'graphql/validation/rules/KnownFragmentNames'
import { KnownDirectives } from 'graphql/validation/rules/KnownDirectives'
import { ExecutableDefinitions } from 'graphql/validation/rules/ExecutableDefinitions'
import { ASTValidationContext } from 'graphql/validation/ValidationContext'
// locals
import { CollectedGraphQLDocument } from '../types'
import { HoudiniDocumentError, HoudiniErrorTodo } from '../error'

// build up a list of the rules we want to validate with
const validateRules = [...graphql.specifiedRules].filter(
	// remove the rules that conflict with our
	(rule) =>
		![
			// fragments are defined on their own so unused fragments are a face of life
			NoUnusedFragments,
			// query documents don't contain the fragments they use so we can't enforce
			// that we know every fragment
			KnownFragmentNames,
			// some of the documents (ie the injected ones) will contain directive defintions
			// and therefor not be explicitly executable
			ExecutableDefinitions,
			// connection include directives that aren't defined by the schema
			KnownDirectives,
		].includes(rule)
)

// typeCheck verifies that the documents are valid instead of waiting
// for the compiler to fail later down the line.
export default async function typeCheck(
	config: Config,
	docs: CollectedGraphQLDocument[]
): Promise<void> {
	// wrap the errors we run into in a HoudiniError
	const errors: HoudiniDocumentError[] = []
	for (const { filename, document: parsed } of docs) {
		// validate the document
		for (const error of graphql.validate(config.schema, parsed, validateRules)) {
			errors.push({
				...error,
				filepath: filename,
			})
		}
	}
	// if we found any type errors
	if (errors.length > 0) {
		throw errors
	}

	// we need to catch errors in the connection API. this means that a user
	// must provide parentID if they are using a connection that is not all-objects
	// from root. figure out which connections are "free" (ie, can be applied without a parentID arg)

	const freeConnections: string[] = []
	for (const { filename, document: parsed, printed } of docs) {
		graphql.visit(parsed, {
			[graphql.Kind.DIRECTIVE]: {
				enter(directive, key, parent, path, ancestors) {
					// if the fragment is a connection fragment
					if (directive.name.value !== config.connectionDirective) {
						return
					}

					// look at the list of ancestors to see if we required a parent ID
					let needsParent = false

					// in order to look up field type information we have to start at the parent
					// and work our way down
					// note:  the top-most parent is always gonna be a document so we ignore it
					const parents = [...ancestors] as (
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

					// if we are looking at a fragment definition then the
					// connection needs to have a parent id
					if (definition.kind === 'FragmentDefinition') {
						needsParent = true
					}

					// if we are looking at an operation that's not query
					if (
						definition.kind === 'OperationDefinition' &&
						definition.operation !== 'query'
					) {
						throw new Error('@connection can only appear in queries or fragments')
					}

					// if we are looking at a query
					if (
						definition.kind === 'OperationDefinition' &&
						definition.operation === 'query'
					) {
						let rootType:
							| graphql.GraphQLNamedType
							| undefined
							| null = config.schema.getQueryType()
						if (!rootType) {
							throw new Error('Could not find query type')
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
								throw new HoudiniErrorTodo("Shouldn't get here")
							}

							// if we are looking at a list type
							if (
								graphql.isListType(rootType) ||
								(graphql.isNonNullType(rootType) &&
									graphql.isListType(rootType.ofType))
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
					}

					// if we still dont need a parent by now, add it to the list of free connections
					if (!needsParent) {
						// look up the name of the connection
						const nameArg = directive.arguments?.find(
							({ name }) => name.value === config.connectionNameArg
						)

						if (!nameArg || nameArg.value.kind !== 'StringValue') {
							throw new HoudiniErrorTodo('Could not find name arg')
						}

						freeConnections.push(
							config.connectionInsertFragment(nameArg.value.value),
							config.connectionRemoveFragment(nameArg.value.value)
						)
					}
				},
			},
		})
	}

	for (const { filename, document: parsed, printed } of docs) {
		// build up the custom rule that requires parentID on all connection directives
		// applied to connection fragment spreads whose name does not appear in `freeConnections`
		const requireParentID = (ctx: ASTValidationContext): graphql.ASTVisitor => {
			return {
				[graphql.Kind.FRAGMENT_SPREAD]: {
					enter(node) {
						// if the fragment is not a connection id then move along
						if (!config.isConnectionFragment(node.name.value)) {
							return
						}

						// if the connection fragment doesn't need a parent ID, we can ignore it
						if (freeConnections.includes(node.name.value)) {
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
							[
								config.connectionPrependDirective,
								config.connectionAppendDirective,
							].includes(name.value),
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
							// yell loudly
							throw {
								...new graphql.GraphQLError(
									'parentID is required for this fragment',
									node,
									new graphql.Source(printed),
									node.loc ? [node.loc.start, node.loc.end] : null,
									null
								),
								filepath: filename,
							}
						}
					},
				},
			}
		}

		// validate the document
		for (const error of graphql.validate(config.schema, parsed, [requireParentID])) {
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
