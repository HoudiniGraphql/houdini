import { exportDefault, exportStarFrom, importDefaultFrom } from '../../../codegen/utils'
import type { Config, Document } from '../../../lib'
import { siteURL as SITE_URL, fs, HoudiniError, path, houdini_mode } from '../../../lib'
import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'
import { injectConfig } from './runtimeConfig'

export default async function runtimeGenerator(config: Config, docs: Document[]) {
	const importStatement =
		config.module === 'commonjs'
			? importDefaultFrom
			: (where: string, as: string) => `import ${as} from '${where}'`

	const exportStatement =
		config.module === 'commonjs' ? exportDefault : (as: string) => `export default ${as}`

	const exportStar =
		config.module === 'commonjs'
			? exportStarFrom
			: (where: string) => `export * from '${where}'`

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
		...config.plugins
			.filter((plugin) => plugin.includeRuntime)
			.map((plugin) => generatePluginRuntime(config, plugin)),
		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

async function generatePluginRuntime(config: Config, plugin: Config['plugins'][number]) {
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
	await fs.recursiveCopy(
		runtime_path,
		pluginDir,
		Object.fromEntries(
			Object.entries(plugin.transformRuntime ?? {}).map(([key, value]) => [
				path.join(runtime_path, key),
				(content) => value({ config, content }),
			])
		)
	)
}
