import { ArtifactKind, ensureArtifactImport, find_graphql, parseJS, printJS } from 'houdini'
import type { TransformPage } from 'houdini/vite'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

const AST = recast.types.builders

export async function transformFile(
	page: TransformPage
): Promise<{ code: string; map?: SourceMapInput }> {
	// only consider jsx or tsx files for now
	if (!page.filepath.endsWith('.tsx') && !page.filepath.endsWith('.jsx')) {
		return { code: page.content, map: page.map }
	}
	// parse the content and look for an invocation of the graphql function
	const script = parseJS(page.content, { plugins: ['jsx'] })

	// for now, just replace them with a string
	await find_graphql(page.config, script, {
		skipGraphqlType: true,
		tag({ node, artifact, parsedDocument, parent }) {
			const artifactID = ensureArtifactImport({
				config: page.config,
				artifact,
				body: script.body,
			})

			// we are going to replace the query with an object
			const properties = [
				AST.objectProperty(AST.stringLiteral('artifact'), AST.identifier(artifactID)),
			]

			// NOTE: this structure is duplicated for componentFields (fragments). if any changes are made here
			// please make sure they are copied there too

			// if the query is paginated or refetchable then we need to add a reference to the refetch artifact
			if (page.config.needsRefetchArtifact(parsedDocument)) {
				// if the document is a query then we should use it as the refetch artifact
				let refetchArtifactName = artifactID
				if (artifact.kind !== ArtifactKind.Query) {
					refetchArtifactName = page.config.paginationQueryName(artifact.name)

					ensureArtifactImport({
						config: page.config,
						artifact: {
							name: refetchArtifactName,
						},
						body: script.body,
					})
				}

				properties.push(
					AST.objectProperty(
						AST.stringLiteral('refetchArtifact'),
						AST.identifier(refetchArtifactName)
					)
				)
			}

			// replace the graphql function with the object
			node.replaceWith(AST.objectExpression(properties))
		},
	})

	return printJS(script)
}
