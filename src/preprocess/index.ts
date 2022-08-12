import { getConfig } from '../common'
import { ConfigFile } from '../runtime'

/**
 * The houdini processor automates a lot of boilerplate to make inline documents
 * work.
 *
 * It takes the same configuration values as the houdini config file as well as an
 * optional `configFile` parameter to specify the path to use to find houdini.config.js
 */
export default function houdiniPreprocessor(
	extraConfig: { configFile?: string } & Partial<ConfigFile>
) {
	return {
		async markup({ content, filename }: { content: string; filename: string }) {
			// grab the config
			const config = await getConfig(extraConfig)

			// if we detected a kit project using the preprocessor, tell them they need to update
			if (config.framework === 'kit') {
				throw new Error(`Please use the new vite plugin for SvelteKit. You can import it from houdini/kit and include it in your vite.config.js.
For more information, check out this link: https://www.houdinigraphql.com/guides/release-notes
	`)
			}

			// regardless, this isn't the right package
			throw new Error('this package has moved to houdini/svelte-preprocess')
		},
	}
}
