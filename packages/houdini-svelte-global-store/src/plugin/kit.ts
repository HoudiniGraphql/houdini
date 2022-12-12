import { Config, path } from 'houdini'

import { HoudiniVitePluginConfig } from '.'

// to take from houdini-svelte
export function store_suffix(config: Config) {
	// if config changes, we might have more forbiddenNames to add in the validator
	return 'Store'
}

export function store_name({ config, name }: { config: Config; name: string }) {
	return name + store_suffix(config)
}

export function global_stores_directory_name() {
	return 'stores'
}

// the directory where we put all of the stores
export function global_stores_directory(plugin_root: string) {
	return path.join(plugin_root, global_stores_directory_name())
}

export function global_store_name({ config, name }: { config: Config; name: string }) {
	return plugin_config(config).globalStorePrefix + name
}

export function plugin_config(config: Config): Required<HoudiniVitePluginConfig> {
	const cfg = config.pluginConfig<HoudiniVitePluginConfig>('houdini-svelte-global-store')

	return {
		globalStorePrefix: 'GQL_',
		...cfg,
	}
}
