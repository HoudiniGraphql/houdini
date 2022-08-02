import fs from 'fs/promises'
import path from 'path'
import { fs as memfs, vol } from 'memfs'

export async function readFile(filepath: string): Promise<string | null> {
	if (process.env.NODE_ENV === 'test') {
		try {
			const buildDir = path.join(process.cwd(), 'build')
			if (filepath.startsWith(buildDir)) {
				return await fs.readFile(filepath, 'utf-8')
			}

			return memfs.readFileSync(filepath, 'utf-8')!.toString()
		} catch (e) {
			if (filepath === '/home/alec/dv/houdini/houdini/build/runtime-esm/cache/index.js') {
				console.log(e)
			}
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

export function clearMock() {
	memfs.mkdirpSync(path.join(process.cwd(), '$houdini', 'runtime'))
	memfs.mkdirpSync(path.join(process.cwd(), '$houdini', 'stores'))
	memfs.mkdirpSync(path.join(process.cwd(), '$houdini', 'artifacts'))
	memfs.mkdirpSync(path.join(process.cwd(), '$houdini', 'graphql'))
	memfs.mkdirpSync(path.join(process.cwd(), 'src', 'routes'))
}
clearMock()

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

export async function mkdir(filepath: string) {
	// no mock in production
	if (process.env.NODE_ENV !== 'test') {
		return await fs.mkdir(filepath)
	}

	return memfs.mkdirpSync(filepath)
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
