// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'

const AST = recast.types.builders

export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// we want to export every artifact from the index file
	const file = AST.program([
		AST.exportNamedDeclaration(
			null,
			[AST.exportSpecifier(AST.identifier('foo'), AST.identifier('default'))],
			AST.literal('./foo')
		),
	])

	// write the result to the artifact path we're configured to write to
	await fs.writeFile(path.join(config.artifactDirectory, 'index.js'), recast.print(file).code)
}
