// @ts-nocheck
import filesystem from 'fs'

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

filesystem.readdirSync = function (path, options) {
	if (!path.includes('routes')) return _readDirSync(path, options)
	const result = _readDirSync(path, options)
	// if there is a route component but no script, add the script
	if (result.includes('+page.svelte') && !result.includes('+page.js')) {
		result.push('+page.js')
	}

	return result
}

Object.defineProperty(globalThis, 'fs', {
	configurable: true,
	enumerable: true,
	value: filesystem,
})
