import path from 'path'

import { Config, writeFile } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { cjsIndexFilePreamble, exportStarFrom, exportDefaultFrom } from '../../utils'

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
	const clientPath =
		'./' +
		path
			.relative(config.rootDir, path.join(config.projectRoot, config.client))
			.split(path.sep)
			.join('/')

	// make sure the content uses the correct module system
	let body = ''
	if (config.module === 'commonjs') {
		body = `${cjsIndexFilePreamble}

${exportDefaultFrom(configPath, 'houdiniConfig')}
${exportDefaultFrom(clientPath, 'houdiniClient')}

${exportStarFrom(runtimeDir)}
${exportStarFrom(artifactDir)}
${exportStarFrom(definitionsDir)}
`
	}
	// otherwise just use esm statements as the final result
	else {
		body = `
export { default as houdiniConfig } from "${configPath}"
export { default as houdiniClient } from "${clientPath}"
export * from "${runtimeDir}"
export * from "${artifactDir}"
export * from "${storesDir}"
export * from "${definitionsDir}"
`
	}

	// write the index file that exports the runtime
	await writeFile(path.join(config.rootDir, 'index.js'), body)
}
