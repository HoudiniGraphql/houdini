import * as recast from 'recast'
import * as graphql from 'graphql'
import { Config, ensureStoreImport, TransformDocument } from '../../common'
import { walkTaggedDocuments } from '../utils'

const AST = recast.types.builders

export default async function queryProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// if there is no instance script we don't care about the document
	if (!doc.instance) {
		return
	}

	// go to every graphql document
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		onTag(tag) {
			// pull out what we need
			const { parsedDocument } = tag
			const operation = parsedDocument.definitions[0] as graphql.ExecutableDefinitionNode

			tag.node.replaceWith(
				AST.identifier(
					ensureStoreImport({
						config,
						body: doc.instance!.content.body,
						artifact: { name: operation.name!.value },
					})
				)
			)
		},
	})
}
