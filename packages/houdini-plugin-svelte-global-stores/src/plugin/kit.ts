import type { Config } from 'houdini'
import { path } from 'houdini'

import type { HoudiniPluginSvelteGlobalStoresConfig } from '.'

export function global_stores_directory_name() {
	return 'stores'
}

// the directory where we put all of the stores
export function global_stores_directory(pluginRoot: string) {
	return path.join(pluginRoot, global_stores_directory_name())
}

export function global_store_name({ config, name }: { config: Config; name: string }) {
	return plugin_config(config).prefix + name
}

export function plugin_config(config: Config): Required<HoudiniPluginSvelteGlobalStoresConfig> {
	const cfg = config.pluginConfig<HoudiniPluginSvelteGlobalStoresConfig>(
		'houdini-plugin-svelte-global-stores'
	)

	return {
		prefix: 'GQL_',
		generate: ['mutation', 'subscription', 'fragment'],
		...cfg,
	}
}
