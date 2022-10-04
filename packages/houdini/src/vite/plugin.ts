import path from 'path'
import type { Plugin as VitePlugin } from 'vite'

import generate from '../codegen'
import { Config, getConfig, PluginConfig } from '../lib/config'
import { formatErrors } from '../lib/graphql'

export default function Plugin(opts: PluginConfig = {}): VitePlugin {
	return {
		name: 'houdini',

		// houdini will always act as a "meta framework" and process the user's code before it
		// is processed by the user's library-specific plugins.
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(viteConfig) {
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
				await generate(await getConfig(opts))
			} catch (e) {
				formatErrors(e)
			}
		},

		// transform the user's code
		async transform(code, filepath) {
			let config: Config
			try {
				config = await getConfig(opts)
			} catch (e) {
				formatErrors(e)
				return
			}

			if (filepath.startsWith('/src/')) {
				filepath = path.join(process.cwd(), filepath)
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!config.includeFile(filepath)) {
				return
			}

			// bundle up the contextual stuff
			const ctx: TransformPage = {
				content: code,
				watch_file: this.addWatchFile,
				config: config,
				filepath,
			}

			// run the plugin pipeline
			for (const plugin of config.plugins) {
				if (!plugin.transform_file) {
					continue
				}
				const { code } = await plugin.transform_file(ctx)
				ctx.content = code
			}

			return { code: ctx.content }
		},
	}
}

export interface TransformPage {
	config: Config
	content: string
	filepath: string
	watch_file: (path: string) => void
}
