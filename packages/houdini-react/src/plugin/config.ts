import type { Config } from 'houdini'
import { path } from 'houdini'
import { testConfig } from 'houdini/test'

import type { HoudiniReactPluginConfig } from '.'
import { hooks } from '.'

export function plugin_config(config: Config): Required<HoudiniReactPluginConfig> {
	return config.pluginConfig<HoudiniReactPluginConfig>('houdini-react')
}
export async function test_config(
	extraConfig: Partial<HoudiniReactPluginConfig> = {}
): Promise<Config> {
	const config = testConfig(extraConfig)
	const plugin = await hooks()
	// @ts-ignore
	config.plugins.push({
		...plugin,
		includeRuntime: './test',
		filepath: path.join(process.cwd(), 'index.js'),
		name: 'test',
	})
	return config
}
