import { exportDefault, exportStarFrom, importDefaultFrom } from '../../../codegen/utils'
import type { Config, Document } from '../../../lib'
import { siteURL as SITE_URL, fs, path } from '../../../lib'
import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'
import { generatePluginRuntimes } from './pluginRuntime'
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

		generatePluginRuntimes({
			config,
			docs,
		}),
		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

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
