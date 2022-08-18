// externals
import path from 'path'
// locals
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportStarFrom } from '../../utils'
import * as fs from '../../../common/fs'

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// the directories we want to export
	const runtimeDir =
		'./' + path.relative(config.rootDir, config.runtimeDirectory).split(path.sep).join('/')
	const artifactDir =
		'./' + path.relative(config.rootDir, config.artifactDirectory).split(path.sep).join('/')
	const storesDir =
		'./' + path.relative(config.rootDir, config.storesDirectory).split(path.sep).join('/')
	const definitionsDir =
		'./' + path.relative(config.rootDir, config.definitionsDirectory).split(path.sep).join('/')
	const configPath = path.relative(config.rootDir, config.filepath).split(path.sep).join('/')
	// if we are rendering an index file for sapper we need to compile it for commonjs
	let body = ''
	if (config.module === 'commonjs') {
		body = `${cjsIndexFilePreamble}

${exportStarFrom(runtimeDir)}
${exportStarFrom(artifactDir)}
${exportStarFrom(definitionsDir)}
${exportStarFrom(storesDir)}
`
	}
	// otherwise just use esm statements as the final result
	else {
		body = `
export * from "${runtimeDir}"
export * from "${artifactDir}"
export * from "${storesDir}"
export * from "${definitionsDir}"
`
	}

	console.log('writing to', path.join(config.rootDir, 'index.js'))
	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), body)
}
