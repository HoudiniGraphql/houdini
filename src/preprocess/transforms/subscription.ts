// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
// locals
import { Config, ensureStoreImport } from '../../common'
import { walkTaggedDocuments } from '../utils'
import { TransformDocument } from '../types'

const AST = recast.types.builders

// returns the expression that should replace the graphql
export default async function subscriptionProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// we need to find any graphql documents in the instance script containing subscriptions
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we don't about care this file
	if (!doc.instance) {
		return
	}

	// go to every graphql document
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		// with only one definition defining a subscription
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
			// the local identifier for the store
			const storeVariable = ensureStoreImport({
				config,
				artifact,
				body: doc.instance!.content.body,
			})

			// replace the node with an object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					AST.objectProperty(AST.literal('store'), AST.identifier(storeVariable)),
					AST.objectProperty(AST.literal('config'), AST.identifier('houdiniConfig')),
				])
			)

			// the kind of import depends on the mode
			const importStatement =
				config.module === 'commonjs'
					? AST.importDefaultSpecifier
					: AST.importNamespaceSpecifier
		},
	})
}
