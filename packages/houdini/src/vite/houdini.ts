import type { SourceMapInput } from 'rollup'
import type { Plugin as VitePlugin, UserConfig } from 'vite'

import generate from '../codegen'
import type { Config, PluginConfig } from '../lib'
import { path, getConfig, formatErrors, deepMerge } from '../lib'

let config: Config

export default function Plugin(opts: PluginConfig = {}): VitePlugin {
	return {
		name: 'houdini',

		// houdini will always act as a "meta framework" and process the user's code before it
		// is processed by the user's library-specific plugins.
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(viteConfig, ...rest) {
			config = await getConfig(opts)

			let result: UserConfig = {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}

			// plugins might want to override values
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.config !== 'function') {
					continue
				}
				result = deepMerge(
					'',
					result,
					await plugin.vite!.config.call(this, config, ...rest)
				)
			}

			return result
		},

		// when the build starts, we need to make sure to generate
		async buildStart(args) {
			try {
				await generate(config)
			} catch (e) {
				formatErrors(e)
			}

			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.buildStart !== 'function') {
					continue
				}

				// @ts-expect-error
				plugin.vite!.buildStart.call(this, {
					...args,
					houdiniConfig: config,
				})
			}
		},

		options(options) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.options !== 'function') {
					continue
				}

				// @ts-expect-error
				options = plugin.vite!.options.call(this, {
					...options,
					houdiniConfig: config,
				})
			}

			return Object.fromEntries(
				Object.entries(options).filter(([key]) => key !== 'houdiniConfig')
			)
		},

		configureServer(server) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.configureServer !== 'function') {
					continue
				}

				const result = plugin.vite!.configureServer.call(this, {
					...server,
					houdiniConfig: config,
				})
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
				map: this.getCombinedSourcemap(),
			}

			// run the plugin pipeline
			for (const plugin of config.plugins) {
				if (!plugin.transformFile) {
					continue
				}
				const { code, map } = await plugin.transformFile(ctx)
				ctx.content = code
				ctx.map = map
			}

			return { code: ctx.content, map: ctx.map }
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
	map?: SourceMapInput
	filepath: string
	watch_file: (path: string) => void
}
