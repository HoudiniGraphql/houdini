import generateGraphqlReturnTypes from './graphqlFunction'
import injectPlugins from './injectPlugins'
import { generatePluginIndex } from './pluginIndex'
import { injectConfig } from './runtimeConfig'

export default async function runtimeGenerator(config: Config, docs: Document[]) {
	// copy the appropriate runtime first so we can generate files over it
	await Promise.all([
		generatePluginIndex({ config, exportStatement: exportStar }),
	])

	await generateGraphqlReturnTypes(config, docs)
}

