// locals
import { getConfig } from '../common'
import { ConfigFile } from '../runtime'
import transform from '../vite/transforms'

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
				throw new Error('Please use the vite plugin.')
			}

			// build up the necessary context to run the vite transform
			const page = {
				config,
				filepath: filename,
				addWatchFile: () => {},
			}

			// apply the transform pipeline
			return await transform(config, page, content)
		},
	}
}
