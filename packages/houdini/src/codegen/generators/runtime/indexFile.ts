// externals
import path from 'path'

// locals
import { Config, CollectedGraphQLDocument } from '../../../lib'
import * as fs from '../../../lib/fs'
import { cjsIndexFilePreamble, exportStarFrom, exportDefaultFrom } from '../../utils'

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	// the directories we want to export
	const runtimeDir =
		'./' + path.relative(config.rootDir, config.runtimeDirectory).split(path.sep).join('/')
	const artifactDir =
		'./' + path.relative(config.rootDir, config.artifactDirectory).split(path.sep).join('/')
	const definitionsDir =
		'./' + path.relative(config.rootDir, config.definitionsDirectory).split(path.sep).join('/')
	// if we are rendering an index file for sapper we need to compile it for commonjs
	const cjs = config.module === 'commonjs'
	let body = cjs ? cjsIndexFilePreamble : ''

	// create the export functions
	const export_star_from = ({ module }: { module: string }) =>
		'\n' + (cjs ? exportStarFrom(module) : `export * from "${module}"`)
	const export_default_as = ({ module, as }: { module: string; as: string }) =>
		'\n' +
		(cjs ? exportDefaultFrom(module, as) : `export { default as ${as} } from "${module}"`)

	// add the standard exports
	body += [
		export_star_from({ module: runtimeDir }),
		export_star_from({ module: artifactDir }),
		export_star_from({ module: definitionsDir }),
	].join('')

	// let any plugins add their own
	for (const plugin of config.plugins) {
		if (!plugin.index_file) {
			continue
		}

		body = plugin.index_file({
			config,
			content: body,
			export_default_as,
			export_star_from,
		})
	}

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), body)
}
