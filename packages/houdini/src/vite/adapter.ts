import type { Plugin } from 'vite'

import { Config, getConfig } from '../lib/config'

let config: Config

export default function HoudiniPlugin(configFile?: string): Plugin {
	return {
		name: 'houdini-vite-adapter',
		async configResolved() {
			config = await getConfig({ configFile })
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
