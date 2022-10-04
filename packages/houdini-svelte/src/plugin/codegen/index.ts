import { HoudiniGenerateHookInput, fs } from 'houdini'

import { stores_directory, type_route_dir } from '../kit'
import adapter from './adapter'
import kit from './kit'
import stores from './stores'

export default async function ({ config, documents }: HoudiniGenerateHookInput) {
	// create the static directories
	await Promise.all([fs.mkdirp(type_route_dir(config)), fs.mkdirp(stores_directory(config))])

	// generate the files
	await Promise.all([adapter(config), kit(config, documents), stores(config, documents)])
}
