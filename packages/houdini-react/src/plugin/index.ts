import { PluginFactory, path } from 'houdini'

import { plugin_config } from './config'

const HoudiniReactPlugin: PluginFactory = async () => ({
	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	transform_runtime: {
		// make sure we can import the client file when we need to
		'network.js': ({ config, content }) => {
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

			return content.replace('HOUDINI_CLIENT_PATH', relativePath)
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
