import fsExtra from 'fs-extra'
import fs from 'fs/promises'
import { fs as memfs } from 'memfs'
import path from 'path'

export async function readFile(filepath: string): Promise<string | null> {
	if (process.env.NODE_ENV === 'test') {
		try {
			const buildDir = path.join(process.cwd(), 'build')
			if (filepath.startsWith(buildDir)) {
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

export async function writeFile(filepath: string, data: string) {
	const existingFileData = await readFile(filepath)
	if (data === existingFileData) {
		return
	}

	// no mock in tests
	if (process.env.NODE_ENV === 'test') {
		return memfs.writeFileSync(filepath, data)
	}

	return await fs.writeFile(filepath, data, 'utf8')
}

export async function access(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.access(filepath)
	}

	const buildDir = path.join(process.cwd(), 'build')
	if (filepath.startsWith(buildDir)) {
		return await fs.access(filepath)
	}

	// split up the path in accessors and keep going until we get undefined
	// or we get a value
	return memfs.statSync(filepath)
}

export async function mkdirp(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fsExtra.mkdirp(filepath)
	}

	return memfs.mkdirpSync(filepath)
}

export async function mkdir(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.mkdir(filepath)
	}

	return memfs.mkdirSync(filepath)
}

export async function rmdir(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.rm(filepath, {
			recursive: true,
		})
	}

	return memfs.rmSync(filepath, {
		recursive: true,
	})
}

export async function stat(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.stat(filepath)
	}

	// if the filepath points to a built package, use the real filesystem
	const buildDir = path.join(process.cwd(), 'build')
	if (filepath.startsWith(buildDir)) {
		return await fs.stat(filepath)
	}

	return memfs.statSync(filepath)
}

export function existsSync(dirPath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return fsExtra.existsSync(dirPath)
	}

	return memfs.existsSync(dirPath)
}

export async function readdir(filepath: string): Promise<string[]> {
	console.log(process.env.NODE_ENV)
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.readdir(filepath)
	}
	const buildDir = path.join(process.cwd(), 'build')
	if (filepath.startsWith(buildDir)) {
		return await fs.readdir(filepath)
	}

	return memfs.readdirSync(filepath) as string[]
}

export async function remove(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.rm(filepath)
	}

	return memfs.rmSync(filepath)
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

export async function recursiveCopy(source: string, target: string, notRoot?: boolean) {
	// if the folder containing the target doesn't exist, then we need to create it
	let parentDir = path.join(target, path.basename(source))
	// if we are at the root, then go up one
	if (!notRoot) {
		parentDir = path.join(parentDir, '..')
	}
	try {
		await fs.access(parentDir)
		// the parent directory does not exist
	} catch (e) {
		await fs.mkdir(parentDir)
	}

	// check if we are copying a directory
	if ((await fs.stat(source)).isDirectory()) {
		// look in the contents of the source directory
		await Promise.all(
			(
				await fs.readdir(source)
			).map(async (child) => {
				// figure out the full path of the source
				const childPath = path.join(source, child)

				// if the child is a directory
				if ((await fs.stat(childPath)).isDirectory()) {
					// keep walking down
					await recursiveCopy(childPath, parentDir, true)
				}
				// the child is a file, copy it to the parent directory
				else {
					const targetPath = path.join(parentDir, child)
					// Do not write `/runtime/adapter.js` file. It will be generated later depending on the framework.
					if (targetPath.endsWith('/runtime/adapter.js')) {
						return
					}
					await fs.writeFile(targetPath, (await fs.readFile(childPath)) || '')
				}
			})
		)
	}
}
