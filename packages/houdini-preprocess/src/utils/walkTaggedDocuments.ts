// externals
import * as graphql from 'graphql'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpressionKind, IdentifierKind } from 'ast-types/gen/kinds'
import { OperationDefinitionNode } from 'graphql/language'
import { BaseNode } from 'estree'
import { DocumentArtifact } from 'houdini-compiler'
import { hashDocument } from 'houdini-common'
// locals
import { TransformDocument } from '../types'

export type EmbeddedGraphqlDocument = {
	parsedDocument: graphql.DocumentNode
	artifact: DocumentArtifact
	node: BaseNode & {
		remove: () => void
		replaceWith: (node: BaseNode) => void
	}
	parent: BaseNode
}

type GraphqlTagWalker = {
	where?: (tag: graphql.DocumentNode) => boolean
	onTag: (tag: EmbeddedGraphqlDocument) => void | Promise<void>
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
				((node as TaggedTemplateExpressionKind).tag as IdentifierKind).name === 'graphql'
			) {
				const expr = node as TaggedTemplateExpressionKind
				// we're going to replace the tag with something the runtime can use

				// first, lets parse the tag contents to get the info we need
				const tagContent = expr.quasi.quasis[0].value.raw
				const parsedTag = graphql.parse(tagContent)

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
				if (!name) {
					throw new Error('Could not find operation name')
				}

				// the location for the document artifact
				const documentPath = doc.config.artifactPath(parsedTag)

				// make sure we watch the compiled fragment
				doc.dependencies.push(documentPath)

				let tag
				try {
					// collect the information we care about
					tag = {
						parsedDocument: parsedTag,
						artifact: (await import(documentPath)) as DocumentArtifact,
						node: {
							...node,
							...this,
							remove: this.remove,
							replaceWith: this.replace,
						},
						parent,
					}
				} catch (e) {
					throw new Error('Looks like you need to run the houdini compiler for ' + name)
				}
				// check if the artifact points to a different query than what the template tag is wrapping
				if (tag.artifact.hash !== hashDocument(tagContent)) {
					throw new Error(
						'Looks like the contents of ' +
							tag.artifact.name +
							' has changed. Please regenerate your runtime.'
					)
				}

				// invoker the walker's callback with the right context
				await walker.onTag(tag)
			}
		},
	})
}
