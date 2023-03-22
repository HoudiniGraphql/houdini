import { ensureArtifactImport, find_graphql, needsRefetchArtifact, parseJS } from 'houdini'
import type { TransformPage } from 'houdini/vite'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'
import config from 'src/runtime/imports/config'

const AST = recast.types.builders

export async function transformFile(
	page: TransformPage
): Promise<{ code: string; map?: SourceMapInput }> {
	// only consider jsx or tsx files for now
	if (!page.filepath.endsWith('.tsx') && !page.filepath.endsWith('.jsx')) {
		return { code: page.content, map: page.map }
	}
	// parse the content and look for an invocation of the graphql function
	const parsed = await parseJS(page.content, {
		plugins: ['typescript', 'jsx'],
		sourceType: 'module',
	})
	if (!parsed) {
		return { code: page.content, map: page.map }
	}

	// for now, just replace them with a string
	await find_graphql(page.config, parsed?.script, {
		tag({ node, artifact, parsedDocument }) {
			const artifactID = ensureArtifactImport({
				config: page.config,
				artifact,
				body: parsed.script.body,
			})

			// we are going to replace the query with an object
			const properties = [
				AST.objectProperty(AST.stringLiteral('artifact'), AST.identifier(artifactID)),
			]

			// if the query is paginated or refetchable then we need to add a reference to the refetch artifact
			if (page.config.needsRefetchArtifact(parsedDocument)) {
				const refetchArtifact = ensureArtifactImport({
					config: page.config,
					artifact: {
						name: page.config.paginationQueryName(artifact.name),
					},
					body: parsed.script.body,
				})
				properties.push(
					AST.objectProperty(
						AST.stringLiteral('refetchArtifact'),
						AST.identifier(refetchArtifact)
					)
				)
			}

			// replace the graphql function with the object
			node.replaceWith(AST.objectExpression(properties))
		},
	})

	return recast.print(parsed.script)
}
