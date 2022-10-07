import { GenerateHookInput, fs } from 'houdini'

import { stores_directory, type_route_dir } from '../kit'
import adapter from './adapter'
import kit from './kit'
import stores from './stores'

export default async function (input: GenerateHookInput) {
	// create the static directories
	await Promise.all([
		fs.mkdirp(type_route_dir(input.config)),
		fs.mkdirp(stores_directory(input.plugin_root)),
	])

	// generate the files
	await Promise.all([adapter(input), kit(input), stores(input)])
}
