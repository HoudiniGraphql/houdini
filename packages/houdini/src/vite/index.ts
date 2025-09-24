import type { Adapter, ConfigFile } from '../lib'
import type { PluginOption } from 'vite'

import houdini from './houdini'

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export default async function (opts?: PluginConfig): Promise<Array<PluginOption>> {
  // each registered plugin could provide a vite portion
  let pluginPlugins: Array<Plugin> = []

  return [
    houdini(opts),
    ...pluginPlugins,
  ]
}

