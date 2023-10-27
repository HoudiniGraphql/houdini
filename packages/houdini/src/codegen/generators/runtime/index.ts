import { exportDefault, exportStarFrom, importDefaultFrom } from '../../../codegen/utils'
import type { Config, Document } from '../../../lib'
import { siteURL as SITE_URL, fs, HoudiniError, path, houdini_mode } from '../../../lib'
import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'
import { injectConfig } from './runtimeConfig'

export default async function runtimeGenerator(config: Config, docs: Document[]) {
	const {
		importStatement,
		exportDefaultStatement: exportStatement,
		exportStarStatement: exportStar,
	} = moduleStatments(config)

	// copy the appropriate runtime first so we can generate files over it
	await Promise.all([
		fs.recursiveCopy(config.runtimeSource, config.runtimeDirectory, {
			// update the link to the site for error messages
			[path.join(config.runtimeSource, 'lib', 'constants.js')]: (content) => {
				return content.replace('SITE_URL', SITE_URL)
			},
			// update the plugin config export
			[path.join(config.runtimeSource, 'imports', 'pluginConfig.js')]: (content) => {
				return injectConfig({ config, importStatement, exportStatement, content })
			},
			// make sure the config import points to the correct file
			[path.join(config.runtimeSource, 'imports', 'config.js')]: (content) => {
				// the path to the config file
				const configFilePath = path.join(config.runtimeDirectory, 'imports', 'config.js')
				// the relative path
				const relativePath = path.relative(path.dirname(configFilePath), config.filepath)

				return `${importStatement(relativePath, 'config')}
${exportStatement('config')}
`
			},
			// we need to update the list of client plugins that get injected by codegen plugins
			[path.join(config.runtimeSource, 'client', 'plugins', 'injectedPlugins.js')]: (
				content
			) => injectPlugins({ config, content, importStatement, exportStatement }),
		}),
		transformPluginRuntimes({ config, docs }),
		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

export async function generatePluginRuntimes({ config }: { config: Config }) {
	await Promise.all(
		config.plugins
			.filter((plugin) => plugin.includeRuntime)
			.map(async (plugin) => {
				if (houdini_mode.is_testing || !plugin.includeRuntime) {
					return
				}

				// a plugin has told us to include a runtime then the path is relative to the plugin file
				const runtime_path = path.join(
					path.dirname(plugin.filepath),
					typeof plugin.includeRuntime === 'string'
						? plugin.includeRuntime
						: plugin.includeRuntime[config.module]
				)

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

				await fs.mkdirp(pluginDir)
				await fs.recursiveCopy(runtime_path, pluginDir)
			})
	)
}

async function transformPluginRuntimes({ config, docs }: { config: Config; docs: Document[] }) {
	const { importStatement, exportDefaultStatement, exportStarStatement } = moduleStatments(config)

	await Promise.all(
		config.plugins
			.filter((plugin) => plugin.includeRuntime)
			.map(async (plugin) => {
				// the transform map holds a map of files to transform functions
				let transformMap = plugin.transformRuntime ?? {}
				if (transformMap && typeof transformMap === 'function') {
					transformMap = transformMap(docs, { config })
				}

				// the keys of the transform map are the files we have to transform
				for (const [target, transform] of Object.entries(transformMap)) {
					// the path to the file we're transforming
					const targetPath = path.join(config.pluginRuntimeDirectory(plugin.name), target)

					// read the file
					const content = await fs.readFile(targetPath)
					if (!content) {
						return
					}

					// transform the file
					const transformed = transform({
						config,
						content,
						importStatement,
						exportDefaultStatement: exportDefaultStatement,
						exportStarStatement: exportStarStatement,
					})

					// write the file back out
					await fs.writeFile(targetPath, transformed)
				}
			})
	)
}

function moduleStatments(config: Config) {
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
