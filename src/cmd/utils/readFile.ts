import fs from 'fs/promises'

export async function readFile(path: string) {
	try {
		return await fs.readFile(path, 'utf8')
	} catch (error) {}
	return null
}
