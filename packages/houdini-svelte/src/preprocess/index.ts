import type { ConfigFile } from 'houdini'
import { getConfig } from 'houdini'
import type { TransformPage } from 'houdini/vite'

import transform from '../plugin/transforms'

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

			// build up the necessary context to run the vite transform
			const page: TransformPage = {
				content,
				config,
				filepath: filename,
				watch_file: () => {},
			}

			// apply the transform pipeline
			return await transform('svelte', page)
		},
	}
}
