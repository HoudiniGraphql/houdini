import type { GenerateHookInput, Config } from 'houdini'
import { fs } from 'houdini'

import { stores_directory, type_route_dir } from '../kit'
import components from './components'
import fragmentTypedefs from './fragmentTypedefs'
import kit from './routes'
import stores from './stores'

export default async function (input: PluginGenerateInput) {
	// create the static directories
	await Promise.all([
		fs.mkdirp(type_route_dir(input.config)),
		fs.mkdirp(stores_directory(input.plugin_root)),
	])

	// generate the files
	await Promise.all([
		kit(input.framework, input),
		stores(input),
		components(input.framework, input),
		fragmentTypedefs(input),
	])
}

export type PluginGenerateInput = Omit<GenerateHookInput, 'config'> & {
	config: Config
	framework: 'kit' | 'svelte'
}
