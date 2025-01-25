import * as fs from './fs'
import * as path from './path'

export async function cleanupFiles(pathFolder: string, listOfObj: string[]): Promise<string[]> {
	const listFile = await fs.readdir(pathFolder)
	const storeListFile = listFile
		.filter((c) => c.endsWith('.js') && c !== 'index.js')
		.map((c) => c.slice(0, -3))
		.sort()

	let allFilesNotInList = storeListFile.filter((x) => !listOfObj.includes(x))
	await Promise.all(
		allFilesNotInList.map(async (storeName) => {
			await fs.remove(path.join(pathFolder, `${storeName}.js`))
			await fs.remove(path.join(pathFolder, `${storeName}.d.ts`))
		})
	)

	return allFilesNotInList
}
