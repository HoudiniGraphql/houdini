import type { Config, ConfigFile } from 'houdini'
import { path } from 'houdini'
import { testConfig } from 'houdini/test'

import { hooks } from '.'

export function plugin_config(config: Config): Required<HoudiniRouterPluginConfig> {
	const cfg = config.pluginConfig<HoudiniRouterPluginConfig>('houdini-router')

	return cfg
}

export type HoudiniRouterPluginConfig = {}

export async function test_config(extraConfig: Partial<ConfigFile> = {}): Promise<Config> {
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
