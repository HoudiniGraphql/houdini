// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { walkTaggedDocuments, artifactImport, artifactIdentifier } from '../utils/index.js'
import { TransformDocument } from '../types.js'

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
	await walkTaggedDocuments(config, doc, doc.instance.content, {
		// with only one definition defining a fragment
		// note: the tags that satisfy this predicate will be added to the watch list
		where(tag: graphql.DocumentNode) {
			return (
				tag.definitions.length === 1 &&
				tag.definitions[0].kind === graphql.Kind.FRAGMENT_DEFINITION
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
			doc.instance?.content.body.unshift(artifactImport(config, artifact))
		},
	})
}
