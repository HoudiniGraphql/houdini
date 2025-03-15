import type { GenerateHookInput } from 'houdini'
import { fs } from 'houdini'

import { stores_directory, type_route_dir } from '../storeConfig'
import components from './components'
import fragmentTypedefs from './fragmentTypedefs'
import kit from './routes'
import stores from './stores'

export default async function (input: PluginGenerateInput) {
	// create the static directories
	await Promise.all([
		fs.mkdirp(type_route_dir(input.config)),
		fs.mkdirp(stores_directory(input.pluginRoot)),
	])

	// generate the files
	await Promise.all([
		kit(input.framework, input),
		stores(input),
		components(input.framework, input),
		fragmentTypedefs(input),
	])
}

export type PluginGenerateInput = GenerateHookInput & {
	framework: 'kit' | 'svelte'
}
