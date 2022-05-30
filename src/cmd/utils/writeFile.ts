import fs from 'fs/promises'

export async function writeFile(path: string, data: string) {
	try {
		const existingFileData = await fs.readFile(path, 'utf8')

		if (data === existingFileData) {
			return
		}
	} catch (error) {
		// ignore files which don't yet exist or can't be read
	}

	await fs.writeFile(path, data, 'utf8')
}
