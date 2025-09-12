import type { Adapter, ConfigFile } from '../lib'
import type { Plugin } from 'vite'

import houdini from './houdini'

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export default function (opts?: PluginConfig): Array<Plugin> {
  return [
    houdini(opts),
  ]
}

