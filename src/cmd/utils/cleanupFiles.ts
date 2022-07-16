import { readdir, remove } from 'fs-extra'
import path from 'path'

export async function cleanupFiles(pathFolder: string, listOfObj: string[]): Promise<string[]> {
	const listFile = await readdir(pathFolder, { withFileTypes: true })
	const storeListFile = listFile
		.map((c) => c.name)
		.filter((c) => c.endsWith('.js') && c !== 'index.js')
		.map((c) => c.slice(0, -3))
		.sort()

	let allFilesNotInList = storeListFile.filter((x) => !listOfObj.includes(x))
	await Promise.all(
		allFilesNotInList.map(async (storeName) => {
			await remove(path.join(pathFolder, `${storeName}.js`))
			await remove(path.join(pathFolder, `${storeName}.d.ts`))
		})
	)

	return allFilesNotInList
}
