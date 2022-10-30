import type { PluginFactory } from 'houdini'
import path from 'path'

import { plugin_config } from './config'
import { extract_documents } from './extract'
import { transform_file } from './transform'

const HoudiniReactPlugin: PluginFactory = async () => ({
	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// we need to teach the codegen how to get graphql documents from jsx files
	extract_documents,

	// convert the graphql template tags into references to their artifact
	transform_file,

	// the index file holds an import to the client that we need to replace
	transform_runtime: {
		'index.js': ({ config, content }) => {
			// the path to the network file
			const networkFilePath = path.join(
				config.pluginRuntimeDirectory('houdini-svelte'),
				'network.js'
			)
			// the relative path
			const relativePath = path.relative(
				path.dirname(networkFilePath),
				path.join(config.projectRoot, plugin_config(config).client)
			)

			return content.replace('./client', relativePath)
		},
	},
})

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 */
	client: string
}
