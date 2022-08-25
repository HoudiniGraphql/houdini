import filesystem, { Dirent, PathLike } from 'fs'
import type { Plugin } from 'vite'

import { Config } from '../common'
import { getConfig, readFile } from '../common'

// this plugin is responsible for faking `+page.js` existence in the eyes of sveltekit
export default function HoudiniFsPatch(configFile?: string): Plugin {
	let config: Config

	return {
		name: 'houdini-fs-patch',

		async configResolved() {
			config = await getConfig({ configFile })
		},

		resolveId(id, _, { ssr }) {
			// if we are resolving a route script, pretend its always there
			if (config.isRouteScript(id)) {
				return {
					id,
				}
			}

			return null
		},

		async load(id) {
			let filepath = id
			// if we are processing a route script, we should always return _something_
			if (config.isRouteScript(filepath)) {
				return {
					// code: '',
					code: (await readFile(filepath)) || '',
				}
			}

			// do the normal thing
			return null
		},
	}
}

const _readDirSync = filesystem.readdirSync
const _statSync = filesystem.statSync
const _readFileSync = filesystem.readFileSync

// @ts-ignore
filesystem.readFileSync = function (filepath, options) {
	if (filepath.toString().endsWith('+page.js') || filepath.toString().endsWith('+layout.js')) {
		try {
			return _readFileSync(filepath, options)
		} catch {
			return typeof options === 'string' || options?.encoding ? '' : Buffer.from('')
		}
	}
	return _readFileSync(filepath, options)
}

// @ts-ignore
filesystem.statSync = function (path: string, options: Parameters<filesystem.StatSyncFn>[1]) {
	if (!path.includes('routes')) return _statSync(path, options)
	try {
		const result = _statSync(path, options)
		return result
	} catch (error) {
		return {
			isDirectory: () => false,
		}
	}
}

// @ts-ignore
filesystem.readdirSync = function (
	filepath: PathLike,
	options: Parameters<typeof filesystem.readdirSync>[1]
) {
	if (!filepath.toString().includes('routes')) return _readDirSync(filepath, options)

	// WORKAROUND: Using `unknown` type because our inherited options are not fully exhaustive.
	const result: unknown[] = _readDirSync(filepath, options)

	function getFileName(file: unknown) {
		if (file instanceof Dirent) {
			return file.name
		} else if (typeof file === 'string') {
			return file
		} else {
			return ''
		}
	}

	function hasFileName(name: string) {
		return result.some((file) => {
			return getFileName(file) === name
		})
	}

	function pushVirtualFileName(name: string) {
		if (options.withFileTypes) {
			const dirent: Dirent = {
				name,
				isFile: () => true,
				isDirectory: () => false,
				isBlockDevice: () => false,
				isFIFO: () => false,
				isCharacterDevice: () => false,
				isSocket: () => false,
				isSymbolicLink: () => false,
			}

			result.push(dirent)
		} else {
			result.push(name)
		}
	}

	// if there is a route component but no script, add the script
	const loadFiles = ['+page.js', '+page.ts', '+page.server.js', '+page.server.ts']
	if (hasFileName('+page.svelte') && !result.find((fp) => loadFiles.includes(getFileName(fp)))) {
		pushVirtualFileName('+page.js')
	}

	// if there is a layout file but no layout.js, we need to make one
	const layoutLoadFiles = ['+layout.ts', '+layout.js']
	if (
		hasFileName('+layout.svelte') &&
		!result.find((fp) => layoutLoadFiles.includes(getFileName(fp)))
	) {
		pushVirtualFileName('+layout.js')
	}

	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})
