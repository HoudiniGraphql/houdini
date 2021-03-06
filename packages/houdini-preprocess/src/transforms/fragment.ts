// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { selector, walkTaggedDocuments, selectionAST } from '../utils'
import { TransformDocument } from '../types'
import { FragmentArtifact } from 'houdini'

const AST = recast.types.builders

// returns the expression that should replace the graphql
export default async function fragmentProcesesor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// we need to find any graphql documents in the instance script containing fragments
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we dont about care this file
	if (!doc.instance) {
		return
	}

	// go to every graphql document
	await walkTaggedDocuments(doc, doc.instance.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(tag: graphql.DocumentNode) {
			return (
				tag.definitions.length === 1 &&
				tag.definitions[0].kind === graphql.Kind.FRAGMENT_DEFINITION
			)
		},
		// we want to replace it with an object that the runtime can use
		async onTag({ artifact, parsedDocument, node }) {
			// we know the document contains a single fragment definition
			const parsedFragment = parsedDocument.definitions[0] as graphql.FragmentDefinitionNode

			// figure out the root type
			const rootType = doc.config.schema.getType(
				parsedFragment.typeCondition.name.value
			) as graphql.GraphQLObjectType
			if (!rootType) {
				throw new Error(
					'Could not find type definition for fragment root' +
						parsedFragment.typeCondition.name.value
				)
			}

			// replace the node with an object
			node.replaceWith(
				AST.objectExpression([
					AST.objectProperty(AST.stringLiteral('name'), AST.stringLiteral(artifact.name)),
					AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
					// the primary requirement for a fragment is applyMask, a function that returns the requested
					// data from the object. we're going to build this up as a function
					AST.objectProperty(
						AST.stringLiteral('applyMask'),
						selector({
							config: doc.config,
							artifact,
							rootIdentifier: 'obj',
							rootType,
							selectionSet: parsedFragment.selectionSet,
							root: true,
							parsedDocument,
						})
					),
					AST.objectProperty(
						AST.literal('rootType'),
						AST.stringLiteral((artifact as FragmentArtifact).rootType)
					),
					AST.objectProperty(
						AST.literal('selection'),
						selectionAST((artifact as FragmentArtifact).selection)
					),
				])
			)
		},
	})
}
