import filesystem from 'fs'
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
	filepath,
	options: Parameters<typeof filesystem.readdirSync>[1]
) {
	if (!filepath.toString().includes('routes')) return _readDirSync(filepath, options)
	const result: string[] = _readDirSync(filepath, options).map((res) => res.toString())

	// if there is a route component but no script, add the script
	const loadFiles = ['+page.js', '+page.ts', '+page.server.js', '+page.server.ts']
	if (result.includes('+page.svelte') && !result.find((fp) => loadFiles.includes(fp))) {
		result.push('+page.js')
	}

	// if there is a layout file but no layout.js, we need to make one
	const layoutLoadFiles = ['+layout.ts', '+layout.js']
	if (result.includes('+layout.svelte') && !result.find((fp) => layoutLoadFiles.includes(fp))) {
		result.push('+layout.js')
	}

	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})
