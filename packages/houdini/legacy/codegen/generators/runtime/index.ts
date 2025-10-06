import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'
import { injectConfig } from './runtimeConfig'

export default async function runtimeGenerator(config: Config, docs: Document[]) {
	// copy the appropriate runtime first so we can generate files over it
	await Promise.all([
		fs.recursiveCopy(config.runtimeSource, config.runtimeDirectory, {
			// we need to update the list of client plugins that get injected by codegen plugins
			[path.join(config.runtimeSource, 'client', 'plugins', 'injectedPlugins.js')]: (
				content
			) => injectPlugins({ config, content, importStatement, exportStatement }),
		}),

		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

