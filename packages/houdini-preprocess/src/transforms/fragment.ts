// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { Config } from 'houdini-common'
// locals
import { walkTaggedDocuments, artifactImport, artifactIdentifier, ensureImports } from '../utils'
import { TransformDocument } from '../types'

const AST = recast.types.builders

// returns the expression that should replace the graphql
export default async function fragmentProcessor(
	config: Config,
	doc: TransformDocument
): Promise<void> {
	// we need to find any graphql documents in the instance script containing fragments
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we don't about care this file
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
		// if we found a tag we want to replace it with an object that the runtime can use
		async onTag({ artifact, node, tagContent }) {
			// the local identifier for the artifact
			const artifactVariable = artifactIdentifier(artifact)

			// replace the node with an object
			const replacement = AST.objectExpression([
				AST.objectProperty(AST.stringLiteral('kind'), AST.stringLiteral(artifact.kind)),
				AST.objectProperty(AST.literal('artifact'), AST.identifier(artifactVariable)),
				AST.objectProperty(AST.literal('config'), AST.identifier('houdiniConfig')),
			])

			// add an import to the body pointing to the artifact
			doc.instance!.content.body.unshift(artifactImport(config, artifact))

			// if the fragment is paginated we need to add a reference to the pagination query
			if (tagContent.includes(`@${config.paginateDirective}`)) {
				// add the import to the pagination query
				doc.instance!.content.body.unshift(
					artifactImport(config, { name: config.paginationQueryName(artifact.name) })
				)

				// and a reference in the tag replacement
				replacement.properties.push(
					AST.objectProperty(
						AST.literal('paginationArtifact'),
						AST.identifier(config.paginationQueryName(artifact.name))
					)
				)
			}

			node.replaceWith(replacement)
		},
	})
}
