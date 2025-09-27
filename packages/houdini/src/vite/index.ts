import type { PluginOption } from 'vite'

import type { Adapter, ConfigFile } from '../lib'
import hmr from './hmr'

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export default async function (opts?: PluginConfig): Promise<Array<PluginOption>> {
	// each registered plugin could provide a vite portion
	let pluginPlugins: Array<Plugin> = []

	return [hmr(opts), ...pluginPlugins]
}
