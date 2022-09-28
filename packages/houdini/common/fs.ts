import fsExtra from 'fs-extra'
import fs from 'fs/promises'
import { fs as memfs, vol } from 'memfs'
import path from 'path'

import { testConfig } from './tests'

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

export async function clearMock() {
	const config = testConfig()

	vol.reset()
	await Promise.all([
		config.createDirectories(),
		memfs.mkdirpSync(path.join(process.cwd(), 'src', 'routes')),
		memfs.mkdirpSync(path.join(process.cwd(), 'src', 'lib')),
	])
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
