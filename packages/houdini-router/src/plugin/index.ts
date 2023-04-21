import { plugin } from 'houdini'

import generate from './codegen'

export const PluginHooks = async () => ({
	generate,
})

export default plugin('houdini-router', PluginHooks)

export type { HoudiniRouterPluginConfig } from './config'
