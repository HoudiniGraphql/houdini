// @ts-nocheck
import filesystem from 'fs'
import path from 'path'

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

filesystem.readFileSync = function (filepath, options) {
	if (filepath.endsWith('+page.js') || filepath.endsWith('+page.ts')) {
		try {
			return _readFileSync(filepath, options)
		} catch {
			return options.encoding ? '' : Buffer.from('')
		}
	}
	return _readFileSync(filepath, options)
}

filesystem.statSync = function (path, options) {
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

filesystem.readdirSync = function (filepath, options) {
	if (!filepath.includes('routes')) return _readDirSync(filepath, options)
	const result = _readDirSync(filepath, options)

	// if there is a route component but no script, add the script
	const loadFiles = ['+page.js', '+page.ts', '+page.server.js', '+page.server.ts']
	if (result.includes('+page.svelte') && !result.find((fp) => loadFiles.includes(fp))) {
		result.push('+page.js')
	}

	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})
