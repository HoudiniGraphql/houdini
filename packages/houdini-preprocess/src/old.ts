// externals
import path from 'path'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { OperationDefinitionNode } from 'graphql/language'
// locals
import { CompiledDocument, OperationDocumentKind, FragmentDocumentKind } from 'houdini-compiler'

// the houdini preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
export default function houdiniPreprocessor(config: any) {
	return {
		// the only thing we have to modify is the script blocks
		async script({ content, filename }: { content: string; filename: string }) {
			// parse the javascript content
			const parsed = recast.parse(content, {
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
						// we're going to replace the tag with something the runtime can use

						// first, lets parse the tag contents to get the info we need
						const parsedTag = graphql.parse(expr.quasi.quasis[0].value.raw)

						// make sure there is only one definition
						if (parsedTag.definitions.length > 1) {
							throw new Error('Encountered multiple definitions in a tag')
						}

						// pull out the name of the thing
						const operation = parsedTag.definitions[0] as OperationDefinitionNode
						const name = operation.name?.value
						// grab the document meta data
						let document: CompiledDocument
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
					}
				},
			})

			// return the printed result
			return {
				...recast.print(parsed),
				dependencies: relatedPaths,
			}
		},
	}
}
