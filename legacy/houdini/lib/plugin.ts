import type { Plugin, PluginInit } from './types'

export function plugin(name: string, hooks: Plugin): PluginInit {
	const data: PluginInit = {
		name,
		plugin: hooks,
		__plugin_init__: true,
		with(config) {
			return {
				...data,
				config,
			}
		},
	}

	return data
}
