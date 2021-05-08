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
	// build up the index file that should just export from the runtime
	const body: StatementKind[] = [AST.exportAllDeclaration(AST.literal('./runtime'), null)]

	// write the index file that exports the runtime
	await fs.writeFile(
		path.join(config.rootDir, 'index.js'),
		recast.print(AST.program(body)).code,
		'utf-8'
	)
}
