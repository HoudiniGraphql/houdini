// externals
import { Config } from 'houdini-common'
import * as recast from 'recast'
import path from 'path'
// locals
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportStarFrom, writeFile } from '../../utils'

const AST = recast.types.builders

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// the directories we want to export
	const runtimeDir = './' + path.relative(config.rootDir, config.runtimeDirectory)
	const artifactDir = './' + path.relative(config.rootDir, config.artifactDirectory)

	// if we are rendering an index file for sapper we need to compile it for commonjs
	let body = ''
	if (config.module === 'commonjs') {
		body = `${cjsIndexFilePreamble}

${exportStarFrom(runtimeDir)}
${exportStarFrom(artifactDir)}
`
	}
	// otherwise just use esm statements as the final result
	else {
		body = recast.print(
			AST.program([
				// build up the index file that at least exports the runtime
				AST.exportAllDeclaration(AST.literal(runtimeDir), null),
				// every artifact we generated be exported from the index file
				AST.exportAllDeclaration(AST.literal(artifactDir), null),
			])
		).code
	}

	// write the index file that exports the runtime
	await writeFile(path.join(config.rootDir, 'index.js'), body)
}
