import type { Config, GenerateHookInput } from 'houdini'
import { fs } from 'houdini'

import { global_stores_directory } from '../kit'
import stores from './stores'

export default async function (input: PluginGenerateInput) {
	// create the static directories
	await fs.mkdirp(global_stores_directory(input.pluginRoot))

	// generate the files
	await stores(input)
}

export type PluginGenerateInput = Omit<GenerateHookInput, 'config'> & {
	config: Config
}
