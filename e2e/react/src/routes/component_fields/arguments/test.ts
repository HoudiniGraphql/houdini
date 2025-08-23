import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('Component fields with correct argument value', async ({ page }) => {
	await goto(page, routes.componentFields_arguments)

	// find all of the images
	const images = await page.locator('img').all()
	// every image should have a size of 50
	for (const image of images) {
		expect(await image.getAttribute('src')).toContain('size=100')
	}
})
