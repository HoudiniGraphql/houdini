import { Plugin as VitePlugin } from 'vite'

import { Config, getConfig, PluginConfig } from '../lib/config'

let config: Config

export default function Plugin(opts: PluginConfig): VitePlugin {
	return {
		name: 'houdini-vite-adapter',
		async configResolved() {
			config = await getConfig(opts)
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
	}
}
