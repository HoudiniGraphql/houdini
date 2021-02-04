// externals
import { OperationDocumentKind } from 'houdini-compiler'
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import { TransformDocument } from '../types'
import { selector, walkTaggedDocuments } from '../utils'
const typeBuilders = recast.types.builders

export default async function mutationProcessor(doc: TransformDocument): Promise<void> {
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
				graphqlDoc.definitions[0].kind === OperationDocumentKind &&
				graphqlDoc.definitions[0].operation === 'mutation'
			)
		},
		// we want to replace it with an object that the runtime can use
		onTag({ artifact, parsedDocument, node }) {
			// figure out the root type of the fragment
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode

			// replace the graphql node with the object
			node.replace(
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
		},
	})
}
