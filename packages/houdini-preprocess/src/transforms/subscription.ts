// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { walkTaggedDocuments } from '../utils'
import { TransformDocument } from '../types'
import { artifactIdentifier } from './query'

const AST = recast.types.builders

// returns the expression that should replace the graphql
export default async function subscriptionProcesesor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// we need to find any graphql documents in the instance script containing subscriptions
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we dont about care this file
	if (!doc.instance) {
		return
	}

	// go to every graphql document
	await walkTaggedDocuments(doc, doc.instance.content, {
		// with only one definition defining asubscription
		// note: the tags that satisfy this predicate will be added to the watch list
		where(tag: graphql.DocumentNode) {
			return (
				tag.definitions.length === 1 &&
				tag.definitions[0].kind === graphql.Kind.OPERATION_DEFINITION &&
				tag.definitions[0].operation === 'subscription'
			)
		},
		// we want to replace it with an object that the runtime can use
		async onTag({ artifact, node }) {
			// the local identifier for the artifact
			const artifactVariable = artifactIdentifier(artifact)

			// replace the node with an object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(AST.literal('artifact'), AST.identifier(artifactVariable)),
				])
			)

			// add an import to the body pointing to the artifact
			doc.instance?.content.body.unshift({
				type: 'ImportDeclaration',
				// @ts-ignore
				source: AST.literal(config.artifactImportPath(artifact.name)),
				specifiers: [
					// @ts-ignore
					AST.importDefaultSpecifier(AST.identifier(artifactVariable)),
				],
			})
		},
	})
}
