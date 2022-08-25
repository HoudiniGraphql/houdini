import path from 'path'
import { Plugin } from 'vite'

import generate from '../cmd/generate'
import { Config, formatErrors, getConfig, HoudiniRouteScript, Script } from '../common'
import apply_transforms from './transforms'

export default function HoudiniPlugin(configFile?: string): Plugin {
	let config: Config

	return {
		name: 'houdini',

		// make sure our resolver runs before vite internal resolver to resolve svelte field correctly
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(viteConfig) {
			config = await getConfig({ configFile })

			return {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// when the build starts, we need to make sure to generate
		async buildStart() {
			try {
				await generate(config)
			} catch (e) {
				formatErrors(e)
				throw new Error('see above')
			}
		},

		// transform the user's code
		async transform(code, filepath) {
			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!config.includeFile(filepath)) {
				return
			}

			// bundle up the contextual stuff
			const ctx = {
				parse: this.parse,
				watch_file: this.addWatchFile,
				config: config,
				filepath,
			}

			// run the plugin pipeline
			const result = await apply_transforms(config, ctx, code)

			return result
		},
	}
}

export interface TransformPage {
	config: Config
	script: Script
	filepath: string
	watch_file: (path: string) => void
	mock_page_info?: HoudiniRouteScript
}
