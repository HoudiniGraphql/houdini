import { Config } from 'houdini'

import { HoudiniReactPluginConfig } from '.'

export function plugin_config(config: Config): Required<HoudiniReactPluginConfig> {
	return config.pluginConfig<HoudiniReactPluginConfig>('houdini-react')
}
