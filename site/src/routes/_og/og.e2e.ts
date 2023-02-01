import { test, expect } from '@playwright/test'
import { mkdirp } from 'fs-extra'
import fs from 'fs/promises'

const mainFolders = ['api', 'guides', 'intro']

const getSubFolders = async (main: string) => {
	return (await fs.readdir(`./src/routes/${main}`)).map((sub) => {
		return { main, sub }
	})
}

test('rendering og images', async ({ page }) => {
	// get all folders and format them
	const pagesMetadata = (
		await Promise.all(
			mainFolders.map(async (main) => {
				return getSubFolders(main)
			})
		)
	)
		.flatMap((c) => c)
		.filter((c) => c.sub !== 'index.json')
		.map((c) => {
			return { fileName: `houdini-${c.main}-${c.sub}`, param: c.sub }
		})

	// let's add also the default one
	pagesMetadata.push({ fileName: 'houdini', param: '' })

	for (const folder of pagesMetadata) {
		await page.goto(`/_og?sub=${folder.param}&style=for_ci`)
		await expect(page).toHaveScreenshot(`${folder.fileName}.png`, {
			clip: {
				x: 0,
				y: 0,
				width: 1200,
				// I don't know why but I have to set 605 instead of 630!
				height: 605
			}
		})
	}

	// // copy all files to the public folder
	// await mkdirp('./static/images/og')
	// for (const folder of folders) {
	// 	await fs.copyFile(
	// 		`./src/routes/_og/og.e2e.ts-snapshots/${folder.fileName}-chromium-linux.png`,
	// 		`./static/images/og/${folder.fileName}.png`
	// 	)
	// }
})
