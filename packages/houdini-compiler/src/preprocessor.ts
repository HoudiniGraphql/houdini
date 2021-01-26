// externals
import path from 'path'
import { parse as recast, print, types } from 'recast'
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { OperationDefinitionNode } from 'graphql/language'
const typeBuilders = types.builders
type Property = types.namedTypes.ObjectProperty
// locals
import { CompiledGraphqlOperation, CompiledGraphqlFragment, OperationDocumentKind } from './compile'

type PreProcessorConfig = {
	artifactDirectory: string
	artifactDirectoryAlias: string
	schema: graphql.GraphQLSchema
}

// a place to store memoized results
let memo: {
	[filename: string]: {
		code: string
		dependencies: string[]
	}
} = {}

// the houdini preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
export function preprocessor(config: PreProcessorConfig) {
	return {
		// the only thing we have to modify is the script blocks
		async script({ content, filename }: { content: string; filename: string }) {
			// parse the javascript content
			const parsed = recast(content, {
				parser: require('recast/parsers/typescript'),
			})

			// the list of paths that should be "watched" alongside this file
			const relatedPaths: string[] = []

			// svelte walk over recast?
			await asyncWalk(parsed, {
				async enter(node, parent) {
					// if we are looking at the graphql template tag
					if (
						node.type === 'TaggedTemplateExpression' &&
						((node as TaggedTemplateExpression).tag as Identifier).name === 'graphql'
					) {
						const expr = node as TaggedTemplateExpression

						// we're going to replace the tag with an import from the artifact directory

						// first, lets parse the tag contents to get the info we need
						const parsedTag = graphql.parse(expr.quasi.quasis[0].value.raw)

						// make sure there is only one definition
						if (parsedTag.definitions.length > 1) {
							throw new Error('Encountered multiple definitions in a tag')
						}

						// pull out the name of the thing
						const name = (parsedTag.definitions[0] as OperationDefinitionNode).name
							?.value

						// grab the document meta data
						let document: CompiledGraphqlOperation | CompiledGraphqlFragment
						try {
							// the location for the document artifact
							const documentPath = path.join(config.artifactDirectory, `${name}.js`)

							// try to resolve the compiled document
							document = await import(documentPath)

							// make sure we watch the compiled fragment
							relatedPaths.push(documentPath)
						} catch (e) {
							throw new Error(
								'Looks like you need to run the houdini compiler for ' + name
							)
						}

						// every graphql tag gets replaced by an object with similar fields
						const replacement = typeBuilders.objectExpression([
							typeBuilders.objectProperty(
								typeBuilders.stringLiteral('name'),
								typeBuilders.stringLiteral(document.name)
							),
							typeBuilders.objectProperty(
								typeBuilders.stringLiteral('kind'),
								typeBuilders.stringLiteral(document.kind)
							),
						])

						// if we are looking at an operation
						if (document.kind === OperationDocumentKind) {
							replacement.properties.push(...operationProperties(config, document))
						}
						// we are processing a fragment
						else {
							replacement.properties.push(
								...fragmentProperties(config, document, parsedTag)
							)
						}

						// perform the replacement
						this.replace(replacement)
					}
				},
			})
			// save the result for later
			memo[filename] = {
				...print(parsed),
				dependencies: relatedPaths,
			}

			// return the printed result
			return memo[filename]
		},
	}
}

export function operationProperties(
	config: PreProcessorConfig,
	operation: CompiledGraphqlOperation
): Property[] {
	// pass the raw query string for the network request
	return [
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('raw'),
			typeBuilders.stringLiteral(operation.raw)
		),
	]
}

export function fragmentProperties(
	config: PreProcessorConfig,
	fragment: CompiledGraphqlFragment,
	doc: graphql.DocumentNode
): Property[] {
	const parsedFragment = doc.definitions[0] as graphql.FragmentDefinitionNode

	// the primary requirement for a fragment is the selector, a function that returns the requested
	// data from the object. we're going to build this up as a function

	// add the selector to the inlined object
	return [fragmentSelector(config, parsedFragment)]
}

export function fragmentSelector(
	config: PreProcessorConfig,
	parsedFragment: graphql.FragmentDefinitionNode
): Property {
	// the root type
	const rootType = config.schema.getType(parsedFragment.typeCondition.name.value)
	if (!rootType) {
		throw new Error(parsedFragment.typeCondition.name.value + 'is not a valid type')
	}

	return typeBuilders.objectProperty(
		typeBuilders.stringLiteral('selector'),
		typeBuilders.arrowFunctionExpression(
			[typeBuilders.identifier('obj')],
			typeBuilders.blockStatement([
				typeBuilders.returnStatement(
					typeBuilders.objectExpression([
						// make sure there is always the root reference
						typeBuilders.objectProperty(
							typeBuilders.stringLiteral('__ref'),
							typeBuilders.memberExpression(
								typeBuilders.identifier('obj'),
								typeBuilders.identifier('__ref')
							)
						),

						// process every selection in the selection set
						...parsedFragment.selectionSet.selections.map((selection) => {
							// if the selection is a field without any sub selections
							if (
								selection.kind === graphql.Kind.FIELD &&
								!selection.selectionSet?.selections.length
							) {
								// the name of the field
								const fieldName = selection.alias?.value || selection.name.value

								// we need to add a key to the object that points {fieldName} to obj._ref.{fieldName}
								return typeBuilders.objectProperty(
									typeBuilders.stringLiteral(fieldName),
									typeBuilders.memberExpression(
										typeBuilders.identifier('obj'),
										typeBuilders.identifier(fieldName)
									)
								)
							}

							// the field we are looking at
							const field = (rootType.astNode as graphql.ObjectTypeDefinitionNode).fields?.find(
								(field) => field.name === (selection as graphql.FieldNode).name
							)
							if (!field) {
								throw new Error('Could not find type information for field')
							}

							// if the field is a list
							if (
								selection.kind === graphql.Kind.FIELD &&
								graphql.isListType(field.type)
							) {
								// the name of the field
								const fieldName = selection.alias?.value || selection.name.value

								// we need to return a map over the results to the information we need
								return typeBuilders.objectProperty(
									typeBuilders.stringLiteral(fieldName),
									typeBuilders.memberExpression(
										typeBuilders.identifier('obj'),
										typeBuilders.identifier(fieldName)
									)
								)
							}

							// if we got this far, we dont recognize the selection kind
							throw new Error(
								'Could not create selector for selection type: ' + selection.kind
							)
						}),
					])
				),
			])
		)
	)
}
