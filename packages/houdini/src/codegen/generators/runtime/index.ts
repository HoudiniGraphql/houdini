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
			// the graphql return value
			[path.join(config.runtimeDirectory, 'index.d.ts')]: (content) =>
				generateGraphqlReturnTypes(config, docs, content),
		}),
		...config.plugins
			.filter((plugin) => plugin.include_runtime)
			.map((plugin) => generatePluginRuntime(config, plugin)),
		generatePluginIndex({ config, exportStatement: exportStar }),
	])
}

async function generatePluginRuntime(config: Config, plugin: Config['plugins'][number]) {
	if (houdini_mode.is_testing) {
		return
	}

	// a plugin with a generated runtime has something at <dir>/build/runtime-{esm,cjs}

	// find the location of the plugin
	const source = path.join(
		plugin.directory,
		'build',
		'runtime-' + (config.module === 'esm' ? 'esm' : 'cjs')
	)
	try {
		await fs.stat(source)
	} catch {
		throw new HoudiniError({
			message: name + ' does not have a runtime to generate',
			description: 'please use the houdini-scripts command to bundle your plugin',
		})
	}

	const which = config.module === 'esm' ? 'esm' : 'cjs'

	// copy the runtime
	const pluginDir = config.pluginRuntimeDirectory(plugin.name)
	await fs.mkdirp(pluginDir)
	await fs.recursiveCopy(
		source,
		pluginDir,
		Object.fromEntries(
			Object.entries(plugin.transform_runtime ?? {}).map(([key, value]) => [
				path.join(plugin.directory, 'build', `runtime-${which}`, key),
				(content) => value({ config, content }),
			])
		)
	)
}
