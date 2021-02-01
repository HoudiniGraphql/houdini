// externals
import path from 'path'
import * as recast from 'recast'
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { OperationDefinitionNode } from 'graphql/language'
// locals
import { CompiledDocument, OperationDocumentKind, FragmentDocumentKind } from 'houdini-compiler'
import fragmentReplacement, { TaggedGraphqlFragment } from './fragment'
import queryReplacement, { TaggedGraphqlQuery } from './query'
import mutationReplacement, { TaggedGraphqlMutation } from './mutation'

// the houdini preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
export default function houdiniPreprocessor(config: PreProcessorConfig) {
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

						// what replaces the template tag depends on a few different things
						let replacement: recast.types.namedTypes.Expression | null = null

						// if we are looking at a fragment
						if (document.kind === FragmentDocumentKind) {
							replacement = fragmentReplacement(config, document, parsedTag)
						}
						// we could be looking at a query
						else if (
							document.kind === OperationDocumentKind &&
							operation.operation === 'query'
						) {
							replacement = queryReplacement(config, document, operation)
						}
						// we could be looking at a mutation
						else if (
							document.kind === OperationDocumentKind &&
							operation.operation === 'mutation'
						) {
							replacement = mutationReplacement(config, document, operation)
						}

						// if we couldn't find a replacement
						if (!replacement) {
							throw new Error("Didn't know what to do with document in " + filename)
						}

						// perform the replacement
						this.replace(replacement)
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

// export some types for others to consume

export * from './fragment'
export * from './query'
export * from './mutation'

// the result of the template tag (also what the compiler leaves behind in the artifact directory)
export type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation

export type PreProcessorConfig = {
	artifactDirectory: string
	artifactDirectoryAlias: string
	schema: graphql.GraphQLSchema
}
