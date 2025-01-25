import { moduleStatments } from '.'
import type { Config, Document } from '../../../lib'
import { fs, HoudiniError, path, houdini_mode } from '../../../lib'

export async function generatePluginRuntimes({
	config,
	docs,
}: {
	config: Config
	docs: Document[]
}) {
	if (houdini_mode.is_testing) {
		return
	}

	// generate the import statements
	const { importStatement, exportDefaultStatement, exportStarStatement } = moduleStatments(config)

	// generate the runtime for each plugin
	await Promise.all(
		config.plugins
			.filter((plugin) => plugin.includeRuntime)
			.map(async (plugin) => {
				// a plugin has told us to include a runtime then the path is relative to the plugin file
				const runtime_path = config.pluginRuntimeSource(plugin)
				if (!runtime_path) {
					return
				}

				// make sure the source file exists
				try {
					await fs.stat(runtime_path)
				} catch {
					throw new HoudiniError({
						message: 'Cannot find runtime to generate for ' + plugin.name,
						description: 'Maybe it was bundled?',
					})
				}

				// copy the runtime
				const pluginDir = config.pluginRuntimeDirectory(plugin.name)
				let transformMap = plugin.transformRuntime ?? {}
				if (transformMap && typeof transformMap === 'function') {
					transformMap = transformMap(docs, { config })
				}

				await fs.mkdirp(pluginDir)
				await fs.recursiveCopy(
					runtime_path,
					pluginDir,
					Object.fromEntries(
						Object.entries(transformMap).map(([key, value]) => [
							path.join(runtime_path, key),
							(content) =>
								value({
									config,
									content,
									importStatement,
									exportDefaultStatement,
									exportStarStatement,
								}),
						])
					)
				)
			})
	)
}
