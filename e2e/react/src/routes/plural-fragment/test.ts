import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('@plural fragment renders the whole list through a single useFragment', async ({ page }) => {
	await goto(page, routes.plural_fragment)

	// every user in the snapshot should be rendered
	const items = await page.locator('#plural-list li').all()
	expect(items.length).toBe(4)

	// the masked fragment data should be readable for each item
	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Bruce Willis')
	await expect(page.getByTestId('plural_fragment:2')).toHaveText('Samuel Jackson')
})
