// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { Config } from 'houdini-common'
// locals
import { TransformDocument } from '../types'
import { walkTaggedDocuments } from '../utils'
import { artifactIdentifier } from './query'
const AST = recast.types.builders

export default async function mutationProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no script we don't care about the document
	if (!doc.instance) {
		return
	}

	// figure out the root type
	const rootType = doc.config.schema.getMutationType()
	if (!rootType) {
		throw new Error('Could not find operation type')
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
		// we want to replace it with an object that the runtime can use
		onTag({ artifact, parsedDocument, node }) {
			// replace the graphql node with the object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(
						AST.literal('artifact'),
						AST.identifier(artifactIdentifier(artifact))
					),
				])
			)

			doc.instance?.content.body.unshift({
				type: 'ImportDeclaration',
				// @ts-ignore
				source: AST.literal(config.artifactImportPath(artifact.name)),
				specifiers: [
					// @ts-ignore
					AST.importDefaultSpecifier(AST.identifier(artifactIdentifier(artifact))),
				],
			})
		},
	})
}
