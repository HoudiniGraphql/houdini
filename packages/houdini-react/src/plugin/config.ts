import type { Config } from 'houdini'

import type { HoudiniReactPluginConfig } from '.'

export function plugin_config(config: Config): Required<HoudiniReactPluginConfig> {
	return config.pluginConfig<HoudiniReactPluginConfig>('houdini-react')
}
