import type { Config, ConfigFile } from 'houdini'
import { path } from 'houdini'
import { testConfig } from 'houdini/test'

import { PluginHooks } from '.'

export function plugin_config(config: Config): Required<HoudiniRouterPluginConfig> {
	const cfg = config.pluginConfig<HoudiniRouterPluginConfig>('houdini-router')

	return cfg
}

export type HoudiniRouterPluginConfig = {}

export async function test_config(extraConfig: Partial<ConfigFile> = {}): Promise<Config> {
	const config = testConfig(extraConfig)
	const svelte_plugin = await PluginHooks()
	config.plugins.push({
		...svelte_plugin,
		includeRuntime: './test',
		filepath: path.join(process.cwd(), 'index.js'),
		name: 'test',
	})
	return config
}
