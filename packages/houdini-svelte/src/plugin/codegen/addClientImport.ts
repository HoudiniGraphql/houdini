import { Config, fs } from 'houdini'
import path from 'path'

import { plugin_config } from '../kit'

export default async function addClientImport(config: Config) {
	// all we need to do is compute the relative path from the generated network file
	// to the client in the config file and replace HOUDINI_CLIENT_PATH with the value

	// the path to the network file
	const networkFilePath = path.join(config.pluginRuntimeDirectory('houdini-svelte'), 'network.js')
	// the relative path
	const relativePath = path
		.relative(
			path.dirname(networkFilePath),
			path.join(config.projectRoot, plugin_config(config).client)
		)
		// Windows management
		.replaceAll('\\', '/')

	// read the file, replace the string, update the file
	const contents = await fs.readFile(networkFilePath)
	if (!contents) {
		return
	}

	await fs.writeFile(networkFilePath, contents.replace('HOUDINI_CLIENT_PATH', relativePath))
}
