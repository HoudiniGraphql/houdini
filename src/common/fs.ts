import fs from 'fs/promises'

export async function readFile(path: string) {
	try {
		return await fs.readFile(path, 'utf8')
	} catch (error) {}
	return null
}

export async function writeFile(path: string, data: string) {
	const existingFileData = await readFile(path)
	if (data === existingFileData) {
		return
	}
	await fs.writeFile(path, data, 'utf8')
}
