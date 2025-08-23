import { test, expect } from '@playwright/test'
import { mkdirp } from 'fs-extra'
import fs from 'fs/promises'
import path from 'path'

// if test is failing remove the folder "/site/static/images/og" and generate it fully again
// It will fail a second time because creating all images, but then everything should be in sync and you shouold see a nice diff in git
test('rendering og images', async ({ page }) => {
	// go over all main folders and retreinve all files with the extention .svx
	const all_svx_files = (
		await Promise.all(
			['api', 'guides', 'intro'].map(async (main) => {
				return await getPageSvxFiles(`./src/routes/${main}`, main)
			})
		)
	).flatMap((c) => c)

	// let's add also the default one
	all_svx_files.push({ imageLink: 'houdini.png', title: '' })

	for (const info of all_svx_files) {
		await page.goto(`/_og?sub=${info.title}&style=for_ci`)
		await expect(page).toHaveScreenshot(`${info.imageLink}`, {
			clip: {
				x: 0,
				y: 0,
				width: 1200,
				// I don't know why but I have to set 605 instead of 630!
				height: 605
			}
		})
	}
})

const getPageSvxFiles = async (dir, main) => {
	let results = []
	const files = await fs.readdir(dir)

	for (const file of files) {
		const filePath = path.join(dir, file)
		const stat = await fs.stat(filePath)

		if (stat.isDirectory()) {
			results = results.concat(await getPageSvxFiles(filePath, main))
		} else if (file === '+page.svx') {
			const content = await fs.readFile(filePath, 'utf-8')

			const svxTitleLine = content.split('\n')[1]

			if (svxTitleLine.startsWith('title: ')) {
				const title = svxTitleLine.replace('title: ', '').trim()
				const shortLink = filePath.replace('src/routes/', '').replace('/+page.svx', '')
				results.push({
					main,
					path: filePath,
					title,
					shortLink,
					imageLink: `houdini-${shortLink.replace('/', '-')}.png`
				})
			} else {
				expect(`File ${filePath} should have in line 2 something like`).toBe('title: My title')
			}
		}
	}

	return results
}
