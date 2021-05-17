// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import fs from 'fs/promises'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportStarFrom } from '../../utils'

const AST = recast.types.builders

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// the directories we want to export
	const runtimeDir = './' + path.relative(config.rootDir, config.runtimeDirectory)
	const artifactDir = './' + path.relative(config.rootDir, config.artifactDirectory)

	let body = ''
	// otherwise just use esm statements as the final result
	if (config.mode === 'kit') {
		body = recast.print(
			AST.program([
				// build up the index file that at least exports the runtime
				AST.exportAllDeclaration(AST.literal(runtimeDir), null),
				// every artifact we generated be exported from the index file
				AST.exportAllDeclaration(AST.literal(artifactDir), null),
			])
		).code
	}
	// if we are rendering an index file for sapper we need to compile it for commonjs
	else {
		body = `${cjsIndexFilePreamble}

${exportStarFrom(runtimeDir)}
${exportStarFrom(artifactDir)}
`
	}

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), body, 'utf-8')
}
