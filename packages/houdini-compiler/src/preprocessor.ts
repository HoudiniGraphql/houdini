// externals
import path from 'path'
import { parse as recast, print, types } from 'recast'
import graphql from 'graphql'
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
}

// a place to store memoized results
let memo: {
	[filename: string]: {
		code: string
	}
} = {}

// the houdini preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
export function preprocessor(config: PreProcessorConfig) {
	return {
		// the only thing we have to modify is the script blocks
		async script({ content, filename }: { content: string; filename: string }) {
			if (memo[filename]) {
				return memo[filename]
			}

			// parse the javascript content
			const parsed = recast(content, {
				parser: require('recast/parsers/typescript'),
			})

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

						// import the document's artiface

						// grab the document meta data
						let document: CompiledGraphqlOperation | CompiledGraphqlFragment
						try {
							document = await import(
								path.join(config.artifactDirectory, `${name}.graphql.ts`)
							)
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
			memo[filename] = print(parsed)

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
	return [fragmentSelector(fragment, parsedFragment)]
}

export function fragmentSelector(
	fragment: CompiledGraphqlFragment,
	parsedFragment: graphql.FragmentDefinitionNode
): Property {
	const selector = typeBuilders.arrowFunctionExpression(
		[typeBuilders.identifier('obj')],
		typeBuilders.blockStatement([
			typeBuilders.returnStatement(
				typeBuilders.objectExpression(
					// any field or inline fragment selections contribute fields to the selector
					parsedFragment.selectionSet.selections.map((selection) =>
						typeBuilders.objectProperty(
							typeBuilders.stringLiteral(selection.kind),
							typeBuilders.stringLiteral(fragment.name)
						)
					)
				)
			),
		])
	)

	return typeBuilders.objectProperty(typeBuilders.stringLiteral('selector'), selector)
}
