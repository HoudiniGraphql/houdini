// locals
import type { Config, Document } from '../../../../lib'
import { fs, path } from '../../../../lib'
import { cjsIndexFilePreamble, exportStarFrom, exportDefaultFrom } from '../../utils'

// every document in the application should be re-exported from the root. this allows the user to balance
// code-splitting concerns with the "cleanliness" of importing from a single location
export default async function writeIndexFile(config: Config, docs: Document[]) {
	const relative = (target: string) => './' + path.relative(config.rootDir, target)

	// the directories we want to export
	const runtimeDir = relative(config.runtimeDirectory)
	const artifactDir = relative(config.artifactDirectory)
	const definitionsDir = relative(config.definitionsDirectory)

	// commonjs body
	const cjs = config.module === 'commonjs'
	let body = cjs ? cjsIndexFilePreamble : ''

	// create the export functions
	const exportStar = ({ module }: { module: string }) =>
		'\n' + (cjs ? exportStarFrom(module) : `export * from "${module}"`) + '\n'
	const exportDefaultAs = ({ module, as }: { module: string; as: string }) =>
		'\n' +
		(cjs ? exportDefaultFrom(module, as) : `export { default as ${as} } from "${module}"`) +
		'\n'

	// add the standard exports
	body += [
		// we need to export the client first so that we don't get any weird cycle issues
		exportStar({ module: './' + path.join(runtimeDir, 'client') }),
		exportStar({ module: runtimeDir }),
		exportStar({ module: artifactDir }),
		exportStar({ module: definitionsDir }),
	].join('')

	// plugins can influence the index file
	for (const plugin of config.plugins) {
		// if they need to add stuff directly (from directories that were generated)
		if (plugin.indexFile) {
			body = plugin.indexFile({
				config,
				content: body,
				exportDefaultAs,
				exportStarFrom: exportStar,
				pluginRoot: config.pluginDirectory(plugin.name),
				typedef: false,
				documents: docs,
			})
		}

		// if the plugin generated a runtime
		if (plugin.includeRuntime) {
			body += exportStar({
				module: relative(config.pluginRuntimeDirectory(plugin.name)),
			})
		}
	}

	// write the index file that exports the runtime
	await fs.writeFile(path.join(config.rootDir, 'index.js'), body)
}
