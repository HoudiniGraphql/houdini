import filesystem, { Dirent, PathLike } from 'fs'
import path from 'path'
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
			// if we are resolving a route script or the root layout, pretend its always there
			if (config.isRouteScript(id) || config.isRootLayout(id)) {
				return {
					id,
				}
			}

			return null
		},

		async load(filepath) {
			// if we are processing a route script or the root layout, we should always return _something_
			if (config.isRouteScript(filepath)) {
				return {
					code: (await readFile(filepath)) || '',
				}
			}

			if (config.isRootLayout(filepath)) {
				return {
					code: (await readFile(filepath)) || empty_root_layout,
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
const _unlinkSync = filesystem.unlinkSync

// @ts-ignore
filesystem.readFileSync = function (fp, options) {
	const filepath = fp.toString()

	if (
		filepath.endsWith('+page.js') ||
		is_root_layout(filepath) ||
		filepath.endsWith('+layout.js')
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
				? empty_root_layout
				: Buffer.from(empty_root_layout)
		}
	}
	return _readFileSync(filepath, options)
}

// @ts-ignore
filesystem.statSync = function (filepath: string, options: Parameters<filesystem.StatSyncFn>[1]) {
	if (!filepath.includes('routes')) return _statSync(filepath, options)
	try {
		const result = _statSync(filepath, options)
		return result
	} catch (error) {
		return virtualFile(path.basename(filepath), { withFileTypes: true })
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

	// if there is a route component but no script, add the script
	const loadFiles = ['+page.js', '+page.ts', '+page.server.js', '+page.server.ts']
	if (hasFileName('+page.svelte') && !result.find((fp) => loadFiles.includes(getFileName(fp)))) {
		result.push(virtualFile('+page.js', options))
	}

	// if there is a layout file but no layout.js, we need to make one
	const layoutLoadFiles = ['+layout.ts', '+layout.js']
	if (
		hasFileName('+layout.svelte') &&
		!result.find((fp) => layoutLoadFiles.includes(getFileName(fp)))
	) {
		result.push(virtualFile('+layout.js', options))
	}

	// if we are in looking inside of src/routes and there's no +layout.svelte file
	// we need to create one
	if (is_root_layout(filepath.toString()) && !hasFileName('+layout.svelte')) {
		result.push(virtualFile('+layout.svelte', options))
	}

	// we're done modifying the results
	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})

function virtualFile(name: string, options: Parameters<typeof filesystem.readdirSync>[1]) {
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

function is_root_layout(filepath: string): boolean {
	return (
		filepath.toString().endsWith(path.join('src', 'routes')) &&
		// ignore the src/routes that exists in the
		!filepath.toString().includes(path.join('.svelte-kit', 'types'))
	)
}

const empty_root_layout = '<slot />'
