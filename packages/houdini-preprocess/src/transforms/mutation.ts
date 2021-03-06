// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
import { Config } from 'houdini-common'
import { MutationArtifact } from 'houdini'
import path from 'path'
// locals
import { TransformDocument } from '../types'
import { selector, walkTaggedDocuments, selectionAST } from '../utils'
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
	await walkTaggedDocuments(doc, doc.instance.content, {
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
			// figure out the root type of the fragment
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode

			// the path to the link file
			const linkPath = path.relative(
				path.join(process.cwd(), doc.filename, '..'),
				config.mutationLinksPath(artifact.name)
			)

			// replace the graphql node with the object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('name'), AST.stringLiteral(artifact.name)),
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(AST.stringLiteral('raw'), AST.stringLiteral(artifact.raw)),
					AST.objectProperty(
						AST.stringLiteral('processResult'),
						selector({
							config: doc.config,
							artifact,
							rootIdentifier: 'data',
							rootType,
							selectionSet: operation.selectionSet,
							// grab values from the immediate response
							pullValuesFromRef: false,
							root: true,
							parsedDocument,
						})
					),
					AST.objectProperty(
						AST.stringLiteral('links'),
						AST.callExpression(AST.identifier('import'), [AST.stringLiteral(linkPath)])
					),
					AST.objectProperty(
						AST.literal('response'),
						selectionAST((artifact as MutationArtifact).response)
					),
					AST.objectProperty(
						AST.literal('selection'),
						selectionAST((artifact as MutationArtifact).selection)
					),
				])
			)
		},
	})
}
