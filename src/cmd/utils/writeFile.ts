import fs from 'fs/promises'
import { readFile } from './readFile'

export async function writeFile(path: string, data: string) {
	const existingFileData = await readFile(path)
	if (data === existingFileData) {
		return
	}
	await fs.writeFile(path, data, 'utf8')
}
