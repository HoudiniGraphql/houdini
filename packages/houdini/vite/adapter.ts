import { Plugin } from 'vite'

import { Config, getConfig } from '../common'

let config: Config

export default function HoudiniPlugin(configFile?: string): Plugin {
	return {
		name: 'houdini-vite-adapter',
		async configResolved() {
			config = await getConfig({ configFile })
		},
		async resolveId(...args) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.resolveId !== 'function') {
					continue
				}

				const result = await plugin.vite!.resolveId.call(this, ...args)
				if (result) {
					return result
				}
			}
		},
		async load(...args) {
			for (const plugin of config.plugins) {
				if (typeof plugin.vite?.load !== 'function') {
					continue
				}

				const result = await plugin.vite!.load.call(this, ...args)
				if (result) {
					return result
				}
			}
		},
	}
}
