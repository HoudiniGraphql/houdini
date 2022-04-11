// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import { Config } from '../../common'
import { TransformDocument } from '../types'
import { walkTaggedDocuments, artifactImport, artifactIdentifier, ensureImports } from '../utils'
const AST = recast.types.builders

export default async function mutationProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no script we don't care about the document
	if (!doc.instance) {
		return
	}

	// go to every graphql document
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(graphqlDoc: graphql.DocumentNode) {
			return (
				graphqlDoc.definitions.length === 1 &&
				graphqlDoc.definitions[0].kind === graphql.Kind.OPERATION_DEFINITION &&
				graphqlDoc.definitions[0].operation === 'mutation'
			)
		},
		// if we found a tag in the document we want to replace it with an object
		// that the runtime can use
		onTag({ artifact, node }) {
			// replace the graphql node with the object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(
						AST.literal('artifact'),
						AST.identifier(artifactIdentifier(artifact))
					),
					AST.objectProperty(
						AST.stringLiteral('config'),
						AST.identifier('houdiniConfig')
					),
				])
			)

			doc.instance?.content.body.unshift(artifactImport(config, artifact))
		},
	})
}
