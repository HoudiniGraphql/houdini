// locals
import { Config, CollectedGraphQLDocument, fs, path } from '../../../lib'
import { cjsIndexFilePreamble, exportStarFrom, exportDefaultFrom } from '../../utils'

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	const relative = (target: string) => './' + path.relative(config.rootDir, target)

	// the directories we want to export
	const runtimeDir = relative(config.runtimeDirectory)
	const artifactDir = relative(config.artifactDirectory)
	const definitionsDir = relative(config.definitionsDirectory)

	// if we are rendering an index file for sapper we need to compile it for commonjs
	const cjs = config.module === 'commonjs'
	let body = cjs ? cjsIndexFilePreamble : ''

	// create the export functions
	const export_star_from = ({ module }: { module: string }) =>
		'\n' + (cjs ? exportStarFrom(module) : `export * from "${module}"`) + '\n'
	const export_default_as = ({ module, as }: { module: string; as: string }) =>
		'\n' +
		(cjs ? exportDefaultFrom(module, as) : `export { default as ${as} } from "${module}"`) +
		'\n'

	// add the standard exports
	body += [
		export_star_from({ module: runtimeDir }),
		export_star_from({ module: artifactDir }),
		export_star_from({ module: definitionsDir }),
	].join('')

	// plugins can influence the index file
	for (const plugin of config.plugins) {
		// if they need to add stuff directly (from directories that were generated)
		if (plugin.index_file) {
			body = plugin.index_file({
				config,
				content: body,
				export_default_as,
				export_star_from,
				plugin_root: config.pluginDirectory(plugin.name),
				typedef: false,
				documents: docs,
			})
		}

		// if the plugin generated a runtime
		if (plugin.include_runtime) {
			body += export_star_from({
				module: relative(config.pluginRuntimeDirectory(plugin.name)),
			})
		}

		if (!plugin.index_file) {
			continue
		}
	}

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), body)
}
