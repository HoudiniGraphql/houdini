import filesystem, { Dirent, PathLike } from 'fs'
import { fs, Plugin, path } from 'houdini'

import {
	Framework,
	is_root_layout,
	is_root_layout_server,
	is_route_script,
	resolve_relative,
} from './kit'

// this plugin is responsible for faking `+page.js` existence in the eyes of sveltekit
export default (getFramwork: () => Framework) =>
	({
		async resolveId(filepath, _, { config, isEntry }) {
			// without this check, the block underneath breaks relative imports from root layout
			if (!isEntry) {
				// make sure there is no
				const match = filepath.match('^((../)+)src/routes')
				if (match) {
					return path.join(config.projectRoot, filepath.substring(match[1].length))
				}
				// if there is no deep relative import, do the default thing
				return
			}

			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath.toString())

			// if we are resolving any of the files we need to generate
			if (
				is_route_script(getFramwork(), filepath) ||
				is_root_layout(config, filepath) ||
				is_root_layout_server(config, filepath)
			) {
				return {
					id: resolve_relative(config, filepath),
				}
			}
		},

		load: async (filepath, { config }) => {
			// everything internal to houdini should assume posix paths
			filepath = path.posixify(filepath.toString())

			// if we are processing a route script or the root layout, we should always return _something_
			if (
				is_route_script(getFramwork(), filepath) ||
				is_root_layout_server(config, filepath)
			) {
				filepath = resolve_relative(config, filepath)
				return {
					code:
						(await fs.readFile(filepath)) ||
						(await fs.readFile(path.join(config.projectRoot, filepath))) ||
						'',
				}
			}

			if (is_root_layout(config, filepath)) {
				filepath = resolve_relative(config, filepath)
				return {
					code:
						(await fs.readFile(filepath)) ||
						(await fs.readFile(path.join(config.projectRoot, filepath))) ||
						empty_layout,
				}
			}
		},
	} as Plugin['vite'])

const _readDirSync = filesystem.readdirSync
const _statSync = filesystem.statSync
const _readFileSync = filesystem.readFileSync
const _unlinkSync = filesystem.unlinkSync

// @ts-ignore
filesystem.readFileSync = function (fp, options) {
	const filepath = fp.toString()

	if (
		filepath.endsWith('+page.js') ||
		filepath.endsWith('+layout.js') ||
		filepath.replace('.ts', '.js').endsWith('+layout.server.js')
	) {
		try {
			return _readFileSync(filepath, options)
		} catch {
			return typeof options === 'string' || options?.encoding ? '' : Buffer.from('')
		}
	}

	if (filepath.endsWith(path.join('src', 'routes', '+layout.svelte'))) {
		try {
			return _readFileSync(filepath, options)
		} catch {
			return typeof options === 'string' || options?.encoding
				? empty_layout
				: Buffer.from(empty_layout)
		}
	}
	return _readFileSync(filepath, options)
}

// @ts-ignore
filesystem.statSync = function (filepath: string, options: Parameters<filesystem.StatSyncFn>[1]) {
	if (!filepath.includes('routes') || !path.basename(filepath).startsWith('+')) {
		return _statSync(filepath, options)
	}

	try {
		const result = _statSync(filepath, options)
		return result
	} catch (error) {
		// everything internal to houdini should assume posix paths
		filepath = path.posixify(filepath.toString())

		const mock = virtual_file(path.basename(filepath), { withFileTypes: true })

		// always fake the root +layout.server.js and +layout.svelte
		if (
			filepath.endsWith(path.join('routes', '+layout.svelte')) ||
			filepath.endsWith(path.join('routes', '+layout.svelte')) ||
			filepath.endsWith(path.join('routes', '+layout.server.js')) ||
			filepath.endsWith(path.join('routes', '+layout.server.js'))
		) {
			return mock
		}

		// we want to fake +layout.js if there is a +layout.svelte
		else if (filepath.endsWith('+layout.js')) {
			return mock
		}

		// we want to fake +page.js if there is a +page.svelte
		else if (filepath.endsWith('+page.js')) {
			return mock
		}

		// if we got this far we didn't fake the file
		throw error
	}
}

filesystem.unlinkSync = function (filepath: PathLike) {
	try {
		_unlinkSync(filepath)
	} catch {}
}

// @ts-ignore
filesystem.readdirSync = function (
	filepath: PathLike,
	options: Parameters<typeof filesystem.readdirSync>[1]
) {
	if (!filepath.toString().includes('routes')) return _readDirSync(filepath, options)

	// WORKAROUND: Using `unknown` type because our inherited options are not fully exhaustive.
	const result: unknown[] = _readDirSync(filepath, options)

	const file_names = result.map((file) => {
		if (file instanceof Dirent) {
			return file.name
		} else if (typeof file === 'string') {
			return file
		} else {
			return ''
		}
	})
	function contains(...names: string[]) {
		return names.some((name) => file_names.includes(name))
	}

	// if there is a route component but no script, add the script
	if (
		contains('+page.svelte', '+page.gql') &&
		!contains('+page.js', '+page.ts', '+page.server.js', '+page.server.ts')
	) {
		result.push(virtual_file('+page.js', options))
	}

	// if there is a layout file but no layout.js, we need to make one
	if (contains('+layout.svelte', '+layout.gql') && !contains('+layout.ts', '+layout.js')) {
		result.push(virtual_file('+layout.js', options))
	}

	const posix_filepath = path.posixify(filepath.toString())

	// if we are in looking inside of src/routes and there's no +layout.svelte file
	// we need to create one
	if (is_root_route(posix_filepath) && !contains('+layout.svelte')) {
		result.push(virtual_file('+layout.svelte', options))
	}
	// if we are in looking inside of src/routes and there's no +layout.server.js file
	// we need to create one
	if (is_root_route(posix_filepath) && !contains('+layout.server.js', '+layout.server.ts')) {
		result.push(virtual_file('+layout.server.js', options))
	}

	// there needs to always be a root load function that passes the session down
	if (is_root_route(posix_filepath) && !contains('+layout.js', '+layout.ts')) {
		result.push(virtual_file('+layout.js', options))
	}

	// we're done modifying the results
	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})

function virtual_file(name: string, options: Parameters<typeof filesystem.readdirSync>[1]) {
	return !options?.withFileTypes
		? name
		: {
				name,
				isFile: () => true,
				isDirectory: () => false,
				isBlockDevice: () => false,
				isFIFO: () => false,
				isCharacterDevice: () => false,
				isSocket: () => false,
				isSymbolicLink: () => false,
		  }
}

function is_root_route(filepath: PathLike): boolean {
	filepath = filepath.toString()

	// if the filepath ends with / we need to strip that away
	if (filepath.toString().endsWith('/')) {
		filepath = filepath.slice(0, -1)
	}

	return (
		filepath.endsWith(path.join('src', 'routes')) &&
		// ignore the src/routes that exists in the type roots
		!filepath.includes('.svelte-kit') &&
		!filepath.includes('$houdini')
	)
}

const empty_layout = '<slot />'
