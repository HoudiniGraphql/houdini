// externals
import { OperationDocumentKind } from 'houdini-compiler'
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import { TransformDocument } from '../types'
import { selector, taggedDocuments } from '../utils'
const typeBuilders = recast.types.builders

export default async function queryProcessor(doc: TransformDocument): Promise<void> {
	// if there is no script we don't care about the document
	if (!doc.instance) {
		return
	}

	// look for any graphql documents in the file's script that contain query definitions
	// we watch for changes
	const documents = await taggedDocuments(
		doc,
		doc.instance.content,
		(graphqlDoc) =>
			graphqlDoc.definitions.length === 1 &&
			graphqlDoc.definitions[0].kind === OperationDocumentKind &&
			graphqlDoc.definitions[0].operation === 'query'
	)

	// figure out the root type
	const rootType = doc.config.schema.getQueryType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// process each tag
	for (const { parsed, artifact, replaceTag } of documents) {
		// we know its a fragment definition
		const operation = parsed.definitions[0] as graphql.OperationDefinitionNode

		// replace the graphql tag with the object
		replaceTag(
			typeBuilders.objectExpression([
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('name'),
					typeBuilders.stringLiteral(artifact.name)
				),
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('kind'),
					typeBuilders.stringLiteral(artifact.kind)
				),
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('raw'),
					typeBuilders.stringLiteral(artifact.raw)
				),
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('processResult'),
					selector({
						config: doc.config,
						artifact,
						rootIdentifier: 'data',
						rootType,
						selectionSet: operation.selectionSet,
						// grab values from the immediate response
						pullValuesFromRef: false,
					})
				),
			])
		)
	}
}
