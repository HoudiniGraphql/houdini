import * as fs from 'fs/promises'
import minimatch from 'minimatch'
import path from 'path'

/**
 * Houdini join with forward slashes & taking care of OS paths
 */
export function h_join(...args: string[]) {
	const fullPath = path.join(args.join('/')).replaceAll('\\', '/')
	return fullPath.startsWith('/') ? fullPath : `file:///${fullPath}`
}

export async function all_files_under(dir: string): Promise<string[]> {
	const dirents = await fs.readdir(dir, { withFileTypes: true })
	const files = await Promise.all(
		dirents.map((dirent) => {
			const res = path.resolve(dir, dirent.name)
			return dirent.isDirectory() ? all_files_under(res) : res
		})
	)
	return Array.prototype.concat(...files)
}

export async function all_files_under_matching(
	dir: string,
	pattern: string,
	options: { returnWithOSFormat?: boolean } = {}
): Promise<string[]> {
	const returnWithOSFormat = options.returnWithOSFormat ?? false

	const files = await all_files_under(dir)
	const fullPathPattern = h_join(dir, pattern)

	const filtered: string[] = []
	for (let i = 0; i < files.length; i++) {
		const hJoinFile = h_join(files[i])
		if (minimatch(hJoinFile, fullPathPattern)) {
			filtered.push(returnWithOSFormat ? hJoinFile : files[i])
		}
	}

	return filtered
}

// TODO WINDOWS: check if this is sufficient?
export function hasMagic(str: string) {
	return (
		str.includes('*') ||
		str.includes('?') ||
		str.includes(',') ||
		(str.includes('[') && str.includes(']'))
	)
}
