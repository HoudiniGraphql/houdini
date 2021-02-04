// externals
import path from 'path'
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { OperationDefinitionNode } from 'graphql/language'
import { BaseNode } from 'estree'
// locals
import { CompiledDocument } from 'houdini-compiler'
import { TransformDocument } from '../types'

type EmbeddedGraphqlDocument = {
	parsedDocument: graphql.DocumentNode
	artifact: CompiledDocument
	tag: {
		skip: () => void
		remove: () => void
		replace: (node: BaseNode) => void
	}
}

type GraphqlTagWalker = {
	where?: (tag: graphql.DocumentNode) => boolean
	onTag: (tag: EmbeddedGraphqlDocument) => void
}

// yield the tagged graphql documents contained within the provided AST
export default async function walkTaggedDocuments(
	doc: TransformDocument,
	parsedScript: BaseNode,
	walker: GraphqlTagWalker
): Promise<void> {
	// svelte walk over recast?
	await asyncWalk(parsedScript, {
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

				// if there is a predicate and the graphql tag does not satisfy it
				if (walker.where && !walker.where(parsedTag)) {
					// ignore the tag
					return
				}

				// pull out the name of the thing
				const operation = parsedTag.definitions[0] as OperationDefinitionNode
				const name = operation.name?.value

				try {
					// the location for the document artifact
					const documentPath = path.join(doc.config.artifactDirectory, `${name}.js`)

					// make sure we watch the compiled fragment
					doc.dependencies.push(documentPath)

					// invoker the walker's callback with the right context
					walker.onTag({
						parsedDocument: parsedTag,
						artifact: await import(documentPath),
						tag: this,
					})
				} catch (e) {
					throw new Error('Looks like you need to run the houdini compiler for ' + name)
				}
			}
		},
	})
}
