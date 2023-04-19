import * as recast from 'recast'

import { fs, path, parseJS, printJS, ensureImports, type Config, type Document } from '../../../lib'

const AST = recast.types.builders

export default async function generateGraphqlReturnTypes(config: Config, docs: Document[]) {
	// we need to find the index of the `export default function graphql` in the index.d.ts of the runtime
	const indexPath = path.join(config.runtimeDirectory, 'index.d.ts')
	const fileContent = (await fs.readFile(indexPath)) || ''
	const script = await parseJS(fileContent)

	// figure out if any of the plugins provide a graphql tag export
	const graphqlTagReturn = config.plugins.find(
		(plugin) => plugin.graphqlTagReturn
	)?.graphqlTagReturn
	if (!graphqlTagReturn || !script) {
		return fileContent
	}

	// build up the mapping of hard coded strings to exports
	const overloaded_returns: Record<string, string> = {}
	for (const doc of docs) {
		const return_value = graphqlTagReturn!({
			config,
			document: doc,
			ensureImport({ identifier, module }) {
				ensureImports({
					config,
					body: script.body,
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
		for (const [i, expression] of script.body.entries()) {
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
				script.body.splice(
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

		const { code } = await printJS(script, { reuseWhitespace: false })

		await fs.writeFile(indexPath, code)
	}
}
