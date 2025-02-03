import * as fs from './fs'
import * as path from './path'

export async function plugin_path(plugin_name: string, config_path: string): Promise<string> {
	try {
		// check if we are in a PnP environment
		if (process.versions.pnp) {
			// retrieve the PnP API (Yarn injects the `findPnpApi` into `node:module` builtin module in runtime)
			const { findPnpApi } = require('node:module')

			// this will traverse the file system to find the closest `.pnp.cjs` file and return the PnP API based on it
			// normally it will reside at the same level with `houdini.config.js` file, so it is unlikely that traversing the whole file system will happen
			const pnp = findPnpApi(config_path)

			// this directly returns the ESM export of the corresponding module, thanks to the PnP API
			// it will throw if the module isn't found in the project's dependencies
			return pnp.resolveRequest(plugin_name, config_path, { conditions: new Set(['import']) })
		}

		// otherwise we have to hunt the module down relative to the current path
		const plugin_dir = find_module(plugin_name, config_path)

		// load up the package json
		const package_json_src = await fs.readFile(path.join(plugin_dir, 'package.json'))
		if (!package_json_src) {
			throw new Error('skip')
		}
		const package_json = JSON.parse(package_json_src)

		// a plugin is an executable so it must have a bin field
		if (!package_json.bin) {
			throw new Error('')
		}

		return path.join(plugin_dir, package_json.bin)
	} catch {
		const err = new Error(
			`Could not find plugin: ${plugin_name}. Are you sure its installed? If so, please open a ticket on GitHub.`
		)

		throw err
	}
}

function find_module(pkg: string = 'houdini', currentLocation: string) {
	const pathEndingBy = ['node_modules', pkg]

	// Build the first possible location
	let found = path.join(currentLocation, ...pathEndingBy)

	// previousLocation is nothing
	let previous = ''
	const backFolder: string[] = []

	// if previous !== found that mean that we can go upper
	// if the directory doesn't exist, let's go upper.
	while (previous !== found && !fs.existsSync(found)) {
		// save the previous path
		previous = found

		// add a back folder
		backFolder.push('../')

		// set the new location
		found = path.join(currentLocation, ...backFolder, ...pathEndingBy)
	}

	if (previous === found) {
		throw new Error('Could not find any node_modules/houdini folder')
	}

	return found
}
