import type { GenerateHookInput } from 'houdini'

import components from './components'
import fragmentTypedefs from './fragmentTypedefs'
import stores from './stores'

export default async function (input: PluginGenerateInput) {

	// generate the files
	await Promise.all([
		stores(input),
		components(input.framework, input),
		fragmentTypedefs(input),
	])
}

export type PluginGenerateInput = GenerateHookInput & {
	framework: 'kit' | 'svelte'
}
