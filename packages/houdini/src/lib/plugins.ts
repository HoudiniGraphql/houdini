import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

import * as fs from './fs.js'
import * as path from './path.js'

export async function plugin_path(
	plugin_name: string,
	config_path: string
): Promise<{ executable: string; directory: string }> {
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
			return pnp.resolveRequest(plugin_name, config_path, {
				conditions: new Set(['import']),
			})
		}

		// otherwise we have to hunt the module down relative to the current path
		// use Node.js's built-in module resolution which handles all package managers correctly
		const plugin_dir = find_module(plugin_name, config_path)

		// load up the package json
		const package_json_src = await fs.readFile(path.join(plugin_dir, 'package.json'))
		if (!package_json_src) {
			throw new Error('There is no package.json.')
		}
		const package_json = JSON.parse(package_json_src)

		// a plugin is an executable so it must have a bin field
		if (!package_json.bin) {
			throw new Error('There is no bin defined.')
		}

		return {
			executable: path.join(plugin_dir, package_json.bin),
			directory: plugin_dir,
		}
	} catch (e) {
		const err = new Error(
			`Could not find plugin: ${plugin_name}. Are you sure its installed? If so, please open a ticket on GitHub. ${e}`
		)

		throw err
	}
}

/**
 * Find a module using Node.js's built-in module resolution.
 * This works correctly with all package managers (npm, yarn, pnpm, yarn PnP).
 */
function find_module(pkg: string, config_path: string): string {
	try {
		// For other plugins, create a require function from the config file's context
		const projectRequire = createRequire(pathToFileURL(config_path))

		// Resolve the package.json to get the package directory
		const packageJsonPath = projectRequire.resolve(`${pkg}/package.json`)
		return path.dirname(packageJsonPath)
	} catch {
		// if we fail to find houdini-core, then let's pull the package that houdini depends on
		if (pkg === 'houdini-core') {
			const houdiniRequire = createRequire(import.meta.url)
			const packageJsonPath = houdiniRequire.resolve(`${pkg}/package.json`)
			return path.dirname(packageJsonPath)
		}

		// If the modern approach fails, fall back to manual node_modules traversal
		// This maintains backward compatibility
		return find_module_walking_modules(pkg, path.dirname(config_path))
	}
}

/**
 * Fallback module finding function that manually traverses node_modules directories.
 * Used when Node.js built-in module resolution fails for edge cases.
 */
function find_module_walking_modules(pkg: string = 'houdini', currentLocation: string) {
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
		throw new Error(`Could not find any node_modules/${pkg} folder`)
	}

	return found
}
