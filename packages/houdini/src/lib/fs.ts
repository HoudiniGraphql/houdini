import fsExtra from 'fs-extra'
import fs from 'fs/promises'
import { glob as G } from 'glob'
import { fs as memfs, vol } from 'memfs'
import { promisify } from 'util'

import { houdini_mode } from './constants'
import * as path from './path'

export function copyFileSync(src: string, dest: string): void | null {
	if (houdini_mode.is_testing) {
		try {
			if (src.includes('build/runtime') || dest.includes('build/runtime')) {
				fsExtra.copyFileSync(src, dest)
				return
			}

			memfs.copyFileSync(src, dest)
			return
		} catch (e) {
			return null
		}
	}
	try {
		fsExtra.copyFileSync(src, dest)
		return
	} catch (e) {}

	return null
}

export async function copyFile(src: string, dest: string): Promise<void | null> {
	if (houdini_mode.is_testing) {
		try {
			if (src.includes('build/runtime') || dest.includes('build/runtime')) {
				await fs.copyFile(src, dest)
				return
			}

			await memfs.copyFile(src, dest, (err) => {
				throw err
			})
			return
		} catch (e) {
			return null
		}
	}
	try {
		await fs.copyFile(src, dest)
		return
	} catch (e) {}

	return null
}

export async function readFile(filepath: string): Promise<string | null> {
	if (houdini_mode.is_testing) {
		try {
			if (filepath.includes('build/runtime')) {
				return await fs.readFile(filepath, 'utf-8')
			}

			return memfs.readFileSync(filepath, 'utf-8')!.toString()
		} catch (e) {
			return null
		}
	}

	try {
		return await fs.readFile(filepath, 'utf8')
	} catch (error) {}

	return null
}

export function readFileSync(filepath: string): string | null {
	if (houdini_mode.is_testing) {
		try {
			if (filepath.includes('build/runtime')) {
				return fsExtra.readFileSync(filepath, 'utf-8')
			}

			return memfs.readFileSync(filepath, 'utf-8')!.toString()
		} catch (e) {
			return null
		}
	}

	try {
		return fsExtra.readFileSync(filepath, 'utf-8')
	} catch (error) {}

	return null
}

export async function writeFile(filepath: string, data: string) {
	const existingFileData = await readFile(filepath)
	if (data === existingFileData) {
		return
	}

	// no mock in tests
	if (houdini_mode.is_testing) {
		return memfs.writeFileSync(filepath, data)
	}

	return await fs.writeFile(filepath, data, 'utf8')
}

export async function access(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.access(filepath)
	}

	if (filepath.includes('build/runtime')) {
		return await fs.access(filepath)
	}

	// split up the path in accessors and keep going until we get undefined
	// or we get a value
	return memfs.statSync(filepath)
}

export async function mkdirp(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fsExtra.mkdirp(filepath)
	}

	return memfs.mkdirpSync(filepath)
}

export async function mkdirpSync(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return fsExtra.mkdirpSync(filepath)
	}

	return memfs.mkdirpSync(filepath)
}

export async function mkdir(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.mkdir(filepath)
	}

	return memfs.mkdirSync(filepath)
}

export async function rmdir(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.rm(filepath, {
			recursive: true,
		})
	}

	return await promisify(memfs.rmdir)(filepath)
}

export async function stat(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.stat(filepath)
	}

	// if the filepath points to a built package, use the real filesystem
	if (filepath.includes('build/runtime')) {
		return await fs.stat(filepath)
	}

	return memfs.statSync(filepath)
}

export function existsSync(dirPath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return fsExtra.existsSync(dirPath)
	}

	return memfs.existsSync(dirPath)
}

export async function readdir(filepath: string): Promise<string[]> {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.readdir(filepath)
	}
	if (filepath.includes('build/runtime')) {
		return await fs.readdir(filepath)
	}

	try {
		return memfs.readdirSync(filepath) as string[]
	} catch {
		return []
	}
}

export async function remove(filepath: string) {
	// no mock in production
	if (!houdini_mode.is_testing) {
		return await fs.rm(filepath)
	}

	return vol.rmSync(filepath)
}

type MockFilesystem = { [key: string]: string | MockFilesystem }

export async function mock(target: MockFilesystem[string], filepath: string = '') {
	// assuming mock is always called with an object, process every key
	await Promise.all(
		Object.entries(target).map(async ([key, value]) => {
			const childPath = path.join(filepath, key)
			// if our value is a string, we need to write the contents
			if (typeof value === 'string') {
				await writeFile(childPath, value)
			} else {
				// the key is the new directory name
				await mkdirp(childPath)
				return await mock(value, childPath)
			}
		})
	)
}

export async function recursiveCopy(
	source: string,
	target: string,
	transforms?: Record<string, (content: string) => string>,
	notRoot?: boolean
) {
	// if the folder containing the target doesn't exist, then we need to create it
	let parentDir = path.join(target, path.basename(source))
	// if we are at the root, then go up one
	if (!notRoot) {
		parentDir = path.join(parentDir, '..')
	}
	try {
		await access(parentDir)
		// the parent directory does not exist
	} catch (e) {
		await mkdirp(parentDir)
	}
	// check if we are copying a directory
	if ((await stat(source)).isDirectory()) {
		// look in the contents of the source directory
		await Promise.all(
			(
				await readdir(source)
			).map(async (child) => {
				// figure out the full path of the source
				const childPath = path.join(source, child)

				// if the child is a directory
				if ((await stat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(childPath, parentDir, transforms, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)

					// we might have to transform the value before copying it
					let original = (await readFile(childPath)) || ''
					if (transforms?.[childPath]) {
						original = transforms[childPath](original)
					}

					await writeFile(targetPath, original)
				}
			})
		)
	}
}

// wrap glob in a promise and enforce that the paths are always posix-style
export async function glob(pattern: string) {
	return await promisify(G)(path.posixify(pattern))
}

glob.hasMagic = G.hasMagic
