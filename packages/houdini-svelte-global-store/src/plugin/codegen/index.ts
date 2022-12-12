import { Config, fs, GenerateHookInput } from 'houdini'

import { global_stores_directory } from '../kit'
import stores from './stores'

export default async function (input: PluginGenerateInput) {
	// create the static directories
	await Promise.all([fs.mkdirp(global_stores_directory(input.plugin_root))])

	// generate the files
	await Promise.all([stores(input)])
}

export type PluginGenerateInput = Omit<GenerateHookInput, 'config'> & {
	config: Config
}
