import { exportDefault, exportStarFrom, importDefaultFrom } from '../../../codegen/utils'
import type { Config } from '../../../lib/config'
import { houdini_mode } from '../../../lib/constants'
import { HoudiniError } from '../../../lib/error'
import * as fs from '../../../lib/fs'
import * as path from '../../../lib/path'
import type { Document } from '../../../lib/types'

export function moduleStatments(config: Config) {
	const importStatement =
		config.module === 'commonjs'
			? importDefaultFrom
			: (where: string, as: string) => `import ${as} from '${where}'`

	const exportDefaultStatement =
		config.module === 'commonjs' ? exportDefault : (as: string) => `export default ${as}`

	const exportStarStatement =
		config.module === 'commonjs'
			? exportStarFrom
			: (where: string) => `export * from '${where}'`

	return {
		importStatement,
		exportDefaultStatement,
		exportStarStatement,
	}
}

export async function generateStaticRuntimes({ config }: { config: Config }) {
	if (houdini_mode.is_testing) {
		return
	}

	// generate the runtime for each plugin
	await Promise.all(
		config.plugins
			.filter((plugin) => plugin.staticRuntime)
			.map(async (plugin) => {
				// a plugin has told us to include a runtime then the path is relative to the plugin file
				const runtime_path = config.pluginStaticRuntimeSource(plugin)
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
				const pluginDir = config.pluginStaticRuntimeDirectory(plugin.name)

				await fs.mkdirp(pluginDir)
				await fs.recursiveCopy(runtime_path, pluginDir)
			})
	)
}

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
