import type { Plugin as VitePlugin } from 'vite'

import generate from '../codegen'
import { path, Config, getConfig, PluginConfig, formatErrors } from '../lib'

let config: Config

export default function Plugin(opts: PluginConfig = {}): VitePlugin {
	return {
		name: 'houdini',

		// houdini will always act as a "meta framework" and process the user's code before it
		// is processed by the user's library-specific plugins.
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(viteConfig) {
			config = await getConfig(opts)

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
			}
		},

		// transform the user's code
		async transform(code, filepath) {
			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath)

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

		async load(id, opts, ...rest) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.load !== 'function') {
					continue
				}

				const result = await plugin.vite!.load.call(this, id, { ...opts, config }, ...rest)
				if (result) {
					return result
				}
			}
		},

		async resolveId(id, two, opts, ...rest) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.resolveId !== 'function') {
					continue
				}

				const result = await plugin.vite!.resolveId.call(
					this,
					id,
					two,
					{ ...opts, config },
					...rest
				)
				if (result) {
					return result
				}
			}
		},
	}
}

export interface TransformPage {
	config: Config
	content: string
	filepath: string
	watch_file: (path: string) => void
}
