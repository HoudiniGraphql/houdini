// externals
import * as recast from 'recast'
import * as graphql from 'graphql'
// locals
import { TransformDocument } from '../types'
import { selector, walkTaggedDocuments, EmbeddedGraphqlDocument } from '../utils'
const typeBuilders = recast.types.builders

// in order for query values to update when mutations fire (after the component has mounted), the result of the query has to be a store.
// stores can't be serialized in preload (understandably) so we're going to have to interact with the query document in
// the instance script and treat the module preload as an implementation detail to get the initial value for the store

// what this means in practice is that if we see a getQuery(graphql``) in the instance script of a component, we need to hoist
// it into the module's preload, grab the result and set it as the initial value in the store.

export default async function queryProcessor(doc: TransformDocument): Promise<void> {
	// if there is no module script we don't care about the document
	if (!doc.module) {
		return
	}

	// figure out the root type
	const rootType = doc.config.schema.getQueryType()
	if (!rootType) {
		throw new Error('Could not find operation type')
	}

	// we need to keep a list of the queries that are fired in this document
	// note: node.replace can only be called inside of the walk function
	// so we'll have to leave a reference to what we are going to addto the
	// script down below
	const queries: EmbeddedGraphqlDocument[] = []

	// go to every graphql document
	await walkTaggedDocuments(doc, doc.module.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(graphqlDoc: graphql.DocumentNode) {
			return (
				graphqlDoc.definitions.length === 1 &&
				graphqlDoc.definitions[0].kind === graphql.Kind.OPERATION_DEFINITION &&
				graphqlDoc.definitions[0].operation === 'query'
			)
		},
		// we want to replace it with an object that the runtime can use
		onTag(tag: EmbeddedGraphqlDocument) {
			// pull out what we need
			const { artifact, parsedDocument, node } = tag

			// figure out the root type of the fragment
			const operation = parsedDocument.definitions[0] as graphql.OperationDefinitionNode

			// add the document to the list
			queries.push(tag)

			// replace the graphql node with the object
			node.replaceWith(
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

	// now that we've walked over the document and collected every query doc
	// we need to hoist the queries to a preload in the
}

export function preloadPayloadKey(operation: graphql.OperationDefinitionNode): string {
	return ''
}
