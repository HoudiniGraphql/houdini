import * as recast from 'recast'

import {
	fs,
	parseJS,
	ensureImports,
	type Config,
	type CollectedGraphQLDocument,
} from '../../../lib'

const AST = recast.types.builders

export default async function generateGraphqlReturnTypes(
	config: Config,
	docs: CollectedGraphQLDocument[],
	fileContent: string
): Promise<string> {
	const contents = await parseJS((await fs.readFile(fileContent)) || '')

	// figure out if any of the plugins provide a graphql tag export
	const graphql_tag_return = config.plugins.find(
		(plugin) => plugin.graphql_tag_return
	)?.graphql_tag_return
	if (!graphql_tag_return || !contents) {
		return fileContent
	}

	// build up the mapping of hard coded strings to exports
	const overloaded_returns: Record<string, string> = {}
	for (const doc of docs) {
		const return_value = graphql_tag_return!({
			config,
			doc,
			ensure_import({ identifier, module }) {
				ensureImports({
					config,
					body: contents.script.body,
					sourceModule: module,
					import: [identifier],
				})
			},
		})
		if (return_value) {
			overloaded_returns[doc.originalString] = return_value
		}
	}

	// if we have any overloaded return values then we need to update the index.d.ts of the
	// runtime to return those values
	if (Object.keys(overloaded_returns).length > 0) {
		for (const [i, expression] of (contents?.script.body ?? []).entries()) {
			if (
				expression.type !== 'ExportNamedDeclaration' ||
				expression.declaration?.type !== 'TSDeclareFunction' ||
				expression.declaration.id?.name !== 'graphql'
			) {
				continue
			}

			// we need to insert an overloaded definition for every entry we found
			for (const [queryString, returnValue] of Object.entries(overloaded_returns)) {
				// build up the input with the query string as a hard coded value
				const input = AST.identifier('str')
				input.typeAnnotation = AST.tsTypeAnnotation(
					AST.tsLiteralType(AST.stringLiteral(queryString))
				)

				// it should return the right thing
				contents?.script.body.splice(
					i,
					0,
					AST.exportNamedDeclaration(
						AST.tsDeclareFunction(
							AST.identifier('graphql'),
							[input],
							AST.tsTypeAnnotation(AST.tsTypeReference(AST.identifier(returnValue)))
						)
					)
				)
			}

			// we're done here
			break
		}

		return recast.prettyPrint(contents!.script).code
	}

	return fileContent
}
