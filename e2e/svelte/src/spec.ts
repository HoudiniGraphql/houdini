import { sleep } from '@kitql/helper'
import { expect, test } from '@playwright/test'

test('1 query on the home page', async ({ page }) => {
	await page.goto('/')
	await sleep(777)

	console.log(await page.innerText('body'))

	const allH2 = await page.getByRole('heading', { level: 2 }).allInnerTexts()
	expect(allH2).toStrictEqual(['Hello World! // From Houdini!'])
})
