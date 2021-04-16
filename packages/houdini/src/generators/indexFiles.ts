// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../types'

const AST = recast.types.builders

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(
	config: Config,
	docs: CollectedGraphQLDocument[]
) {
	// build up a list of paths we have types in (to export from index.d.ts)
	const typePaths: string[] = []

	// every document needs a generated type
	await Promise.all(
		// the generated types depend solely on user-provided information
		// so we need to use the original document that we haven't mutated
		// as part of the compiler
		docs.map(async ({ originalDocument, name, printed }) => {
			// the place to put the artifact's type definition
			const typeDefPath = config.artifactTypePath(originalDocument)
			typePaths.push(typeDefPath)
		})
	)

	// now that we have every type generated, create an index file in the runtime root that exports the types
	const typeIndex = AST.program(
		typePaths
			.map((typePath) => {
				return AST.exportAllDeclaration(
					AST.literal(
						'./' +
							path
								.relative(path.resolve(config.typeIndexPath, '..'), typePath)
								// remove the .d.ts from the end of the path
								.replace(/\.[^/.]+\.[^/.]+$/, '')
					),
					null
				)
			})
			.concat([AST.exportAllDeclaration(AST.literal('./runtime'), null)])
	)

	// write the contents
	await fs.writeFile(config.typeIndexPath, recast.print(typeIndex).code, 'utf-8')
}
