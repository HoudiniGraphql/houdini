// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
import { StatementKind } from 'ast-types/gen/kinds'
// locals
import { CollectedGraphQLDocument } from '../../types'

const AST = recast.types.builders

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	const body = AST.program([
		// build up the index file that at least exports the runtime
		AST.exportAllDeclaration(
			AST.literal('./' + path.relative(config.rootDir, config.runtimeDirectory)),
			null
		),
		// every artifact we generated be exported from the index file
		AST.exportAllDeclaration(
			AST.literal('./' + path.relative(config.rootDir, config.artifactDirectory)),
			null
		),
	])

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), recast.print(body).code, 'utf-8')
}
