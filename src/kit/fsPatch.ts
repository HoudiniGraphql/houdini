// @ts-nocheck
import filesystem from 'fs'

// this plugin is responsible for faking `+page.js` existence in the eyes of sveltekit
export default function HoudiniFsPatch(configPath?: string): Plugin {
	let config: Config

	return {
		name: 'houdini-fs-patch',

		async configResolved(viteConfig) {
			config = await getConfig({ configFile })
		},

		resolveId(id, _, { ssr }) {
			if (!ssr) {
				return null
			}

			// if we are resolving a route script, pretend its always there
			if (config.isRouteScript(id)) {
				return {
					id: path.relative(process.cwd(), id),
				}
			}

			return null
		},

		async load(id) {
			// if we are processing a route script, we should always return _something_
			if (config.isRouteScript(id)) {
				return {
					code: (await readFile(id)) || '',
				}
			}

			// do the normal thing
			return null
		},
	}
}

const _readDirSync = filesystem.readdirSync
const _statSync = filesystem.statSync

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
	if (
		result.includes('+page.svelte') &&
		!(result.includes('+page.js') || result.includes('+page.ts'))
	) {
		result.push('+page.js')
	}

	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})
