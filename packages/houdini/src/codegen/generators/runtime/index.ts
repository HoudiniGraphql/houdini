import { exportDefault, exportStarFrom, importDefaultFrom } from '../../../codegen/utils'
import type { Config, CollectedGraphQLDocument } from '../../../lib'
import { siteURL as SITE_URL, fs, HoudiniError, path, houdini_mode } from '../../../lib'
import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
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
			.filter((plugin) => plugin.include_runtime)
			.map((plugin) => generatePluginRuntime(config, plugin)),
		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

async function generatePluginRuntime(config: Config, plugin: Config['plugins'][number]) {
	if (houdini_mode.is_testing || !plugin.include_runtime) {
		return
	}

	// a plugin has told us to include a runtime then the path is relative to the plugin file
	const runtime_path = path.join(
		path.dirname(plugin.filepath),
		typeof plugin.include_runtime === 'string'
			? plugin.include_runtime
			: plugin.include_runtime[config.module]
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
			Object.entries(plugin.transform_runtime ?? {}).map(([key, value]) => [
				path.join(runtime_path, key),
				(content) => value({ config, content }),
			])
		)
	)
}
